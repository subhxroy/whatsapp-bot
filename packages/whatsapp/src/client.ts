import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
  proto,
  downloadMediaMessage,
  downloadContentFromMessage,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { useFirebaseAuthState, clearFirebaseAuthState } from './auth-store';
import {
  extractFallbackIdentity,
  extractRecoveredContent,
  extractContextInfo,
  getMessageBodyType,
  messageTimestampMs,
  unwrapMessageContent,
  isViewOnceMessage,
} from './deleted-message';
import {
  ConnectionStatus,
  DeletedMessageEvent,
  DeletedMessageHandler,
  HistoryMessageEvent,
  HistoryMessageHandler,
  MessageHandler,
  NormalizedMessage,
  StatusHandler,
} from './types';
import { getEnv } from '@private-md-bot/config';

const logger = pino({
  level: 'info',
  redact: ['message.body', 'creds', 'keys', 'qr', 'pairingCode'],
});

export class WhatsAppClient {
  private socket: ReturnType<typeof makeWASocket> | null = null;
  private status: ConnectionStatus = 'DISCONNECTED';
  private qrCode: string | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private deletedMessageHandlers: Set<DeletedMessageHandler> = new Set();
  private historyHandlers: Set<HistoryMessageHandler> = new Set();
  private isExplicitDisconnect = false;
  private reconnectAttempts = 0;
  private recentMessages: Map<string, proto.IWebMessageInfo> = new Map();
  private processedMsgIds: Set<string> = new Set();
  private sessionKey: string;
  private userId: string | null = null;
  private connectedPhone: string | null = null;
  private lidToPnMap = new Map<string, string>();
  private pnToLidMap = new Map<string, string>();

  /** Short-lived bridge: raw CB:message node messageId -> sender_pn (peer phone JID). */
  private senderPnCache = new Map<string, { pn: string; ts: number }>();

  private static readonly MAX_CACHED_MESSAGES = 300;
  private static readonly MAX_CACHED_MESSAGES_PER_CHAT = 100;
  private static readonly MESSAGE_CACHE_TTL_MS = 30 * 60 * 1000;
  private static readonly SENDER_PN_CACHE_TTL_MS = 120_000;

  private processedRevokeIds = new Set<string>();

  constructor(sessionKey: string = 'default_session', userId?: string) {
    this.sessionKey = sessionKey;
    this.userId = userId ?? (sessionKey.startsWith('user_') ? sessionKey.replace(/^user_/, '') : sessionKey);
  }

  public getUserId(): string | null {
    return this.userId;
  }

  /** The phone number (digits only, with country code) of the connected WhatsApp account.
   * Only populated after a successful connection (connection === 'open').
   */
  public getConnectedPhone(): string | null {
    return this.connectedPhone;
  }

  /** The JID of the connected WhatsApp account (e.g. 919864149429:12@s.whatsapp.net or LID). */
  public getConnectedJid(): string | null {
    const raw = this.socket?.user?.id;
    if (!raw) return null;
    return jidNormalizedUser(raw);
  }

  private emitDeletedMessage(event: DeletedMessageEvent): void {
    if (this.processedRevokeIds.has(event.deletedMessageId)) {
      logger.info({ deletedId: event.deletedMessageId }, '[REVOKE] Duplicate revoke event ignored');
      return;
    }
    this.processedRevokeIds.add(event.deletedMessageId);
    if (this.processedRevokeIds.size > 500) {
      const first = this.processedRevokeIds.values().next().value;
      if (first) this.processedRevokeIds.delete(first);
    }
    for (const handler of this.deletedMessageHandlers) {
      try {
        handler(event).catch((err) => {
          logger.error({ err, deletedId: event.deletedMessageId }, 'Error executing deleted-message handler');
        });
      } catch (err) {
        logger.error({ err, deletedId: event.deletedMessageId }, 'Error executing deleted-message handler');
      }
    }
  }

  public registerLidMapping(lid?: string, pnJid?: string): void {
    if (!lid || !pnJid) return;
    const cleanLid = lid.split('@')[0].split(':')[0].replace(/\D/g, '');
    const cleanPn = pnJid.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (cleanLid && cleanPn) {
      this.lidToPnMap.set(cleanLid, cleanPn);
      this.pnToLidMap.set(cleanPn, cleanLid);
      const env = getEnv();
      if (env.MESSAGE_LOGGING) {
        logger.info({ cleanLid, cleanPn }, '[LID] Mapping discovered');
      }
    }
  }

  public getPnForLid(lid?: string): string | undefined {
    if (!lid) return undefined;
    const cleanLid = lid.split('@')[0].split(':')[0].replace(/\D/g, '');
    return this.lidToPnMap.get(cleanLid);
  }

  public getLidForPn(pn?: string): string | undefined {
    if (!pn) return undefined;
    const cleanPn = pn.split('@')[0].split(':')[0].replace(/\D/g, '');
    return this.pnToLidMap.get(cleanPn);
  }

  /** Store sender_pn (full phone JID) against the exact message ID it belongs to. */
  private cacheSenderPn(messageId: string, senderPn: string): void {
    if (!messageId || !senderPn) return;
    this.senderPnCache.set(messageId, { pn: senderPn, ts: Date.now() });
    if (this.senderPnCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of this.senderPnCache) {
        if (now - v.ts > WhatsAppClient.SENDER_PN_CACHE_TTL_MS) {
          this.senderPnCache.delete(k);
        }
      }
    }
  }

  /** Look up the peer's phone JID attached to this exact message ID (TTL-guarded). */
  private getCachedSenderPn(messageId?: string | null): string | undefined {
    if (!messageId) return undefined;
    const entry = this.senderPnCache.get(messageId);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > WhatsAppClient.SENDER_PN_CACHE_TTL_MS) {
      this.senderPnCache.delete(messageId);
      return undefined;
    }
    return entry.pn;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getQRCode(): string | null {
    return this.qrCode;
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /** Subscribe to "deleted for everyone" (REVOKE) events. */
  public onDeletedMessage(handler: DeletedMessageHandler): () => void {
    this.deletedMessageHandlers.add(handler);
    return () => this.deletedMessageHandlers.delete(handler);
  }

  /** Subscribe to message-history snapshots (content gated by caller settings). */
  public onHistoryMessage(handler: HistoryMessageHandler): () => void {
    this.historyHandlers.add(handler);
    return () => this.historyHandlers.delete(handler);
  }

  private setStatus(newStatus: ConnectionStatus, qr?: string): void {
    this.status = newStatus;
    if (qr !== undefined) {
      this.qrCode = qr;
    } else if (newStatus === 'CONNECTED' || newStatus === 'DISCONNECTED') {
      this.qrCode = null;
    }
    this.statusHandlers.forEach((h) => h(newStatus, this.qrCode || undefined));
  }

  public async connect(): Promise<void> {
    if (this.status === 'CONNECTED') {
      return;
    }

    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.ev.removeAllListeners('messages.upsert');
        this.socket.end(undefined);
      } catch {}
      this.socket = null;
    }

    this.isExplicitDisconnect = false;
    this.setStatus('CONNECTING');

    try {
      const { state, saveCreds } = await useFirebaseAuthState(this.sessionKey);
      const { version } = await fetchLatestBaileysVersion();

      this.socket = makeWASocket({
        version,
        logger: logger as any,
        printQRInTerminal: false,
        auth: state,
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
      });

      this.socket.ev.on('creds.update', saveCreds);

      // Bridge: capture sender_pn from the raw CB:message node and attach it to the
      // incoming message by exact message ID. Baileys 6.17.16 exposes sender_pn ONLY on
      // the raw node (messages-recv.js:626) — it never reaches the decoded message or
      // any event payload, so this short-lived ID-keyed cache is the required bridge.
      // Read-only on the node; safe TTL; message-associated (never global/last-wins).
      const rawWs = (this.socket as any)?.ws;
      if (rawWs && typeof rawWs.on === 'function') {
        rawWs.on('CB:message', (node: any) => {
          try {
            const attrs = node?.attrs ?? {};
            const msgId = attrs?.id;
            if (msgId && attrs?.sender_pn) {
              this.cacheSenderPn(msgId, String(attrs.sender_pn));
            }
            if (!String(attrs.from || '').includes('@lid')) return;
            const childJids: Record<string, string> = {};
            if (Array.isArray(node?.content)) {
              for (const child of node.content) {
                if (child?.tag && child.attrs && typeof child.attrs.jid === 'string') {
                  childJids[child.tag] = child.attrs.jid;
                }
              }
            }
            logger.info(
              {
                from: attrs.from,
                participant: attrs.participant,
                sender_pn: attrs.sender_pn,
                participant_pn: attrs.participant_pn,
                participantPn: attrs.participantPn,
                phoneNumber: attrs.phoneNumber,
                jid: attrs.jid,
                lid: attrs.lid,
                id: attrs.id,
                t: attrs.t,
                type: attrs.type,
                childJids,
              },
              '[CALDERA_DEBUG][CB:MESSAGE]'
            );
          } catch (err) {
            logger.warn({ err: (err as Error)?.message }, '[CALDERA_DEBUG][CB:MESSAGE] error');
          }
        });
      }

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          logger.info('Fresh WhatsApp QR Code generated');
          this.setStatus('PAIRING', qr);
        }

        if (connection === 'close') {
          const err = lastDisconnect?.error;
          const statusCode = (err as Boom)?.output?.statusCode;
          const errMsg = err?.message || String(err || '');
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isQrTimeout =
            statusCode === DisconnectReason.timedOut ||
            statusCode === 408 ||
            errMsg.includes('QR refs attempts ended');

          if (isLoggedOut) {
            logger.warn('WhatsApp session logged out by user — clearing auth store');
            await clearFirebaseAuthState(this.sessionKey);
            this.socket = null;
            this.reconnectAttempts = 0;
            this.setStatus('DISCONNECTED');
            return;
          }

          if (isQrTimeout) {
            logger.warn({ sessionKey: this.sessionKey }, 'WhatsApp QR code pairing timed out without scan — stopping auto-reconnect');
            this.socket = null;
            this.reconnectAttempts = 0;
            this.setStatus('DISCONNECTED');
            return;
          }

          const shouldReconnect = !this.isExplicitDisconnect;
          logger.warn({ shouldReconnect, reason: lastDisconnect?.error }, 'WhatsApp connection closed');
          this.setStatus('DISCONNECTED');

          if (shouldReconnect) {
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), delay);
          } else {
            this.socket = null;
            this.reconnectAttempts = 0;
          }
        } else if (connection === 'open') {
          logger.info('WhatsApp connection successfully established');
          this.reconnectAttempts = 0;
          // Capture the connected WhatsApp phone number for per-user settings.
          // socket.user?.id is a JID like "919864149429:12@s.whatsapp.net"
          const rawJid = this.socket?.user?.id ?? '';
          const phoneDigits = rawJid.split('@')[0].split(':')[0].replace(/\D/g, '');
          if (phoneDigits) {
            this.connectedPhone = phoneDigits;
            logger.info({ phone: phoneDigits }, 'Connected WhatsApp phone captured');
          }
          this.setStatus('CONNECTED');
        }
      });

      this.socket.ev.on('contacts.upsert', (contacts) => {
        for (const contact of contacts) {
          if (contact.id && contact.lid) {
            this.registerLidMapping(contact.lid, contact.id);
          }
        }
      });

      this.socket.ev.on('contacts.update', (updates) => {
        for (const update of updates) {
          if (update.id && update.lid) {
            this.registerLidMapping(update.lid, update.id);
          }
        }
      });

      this.socket.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
        if (lid && jid) {
          logger.info({ lid, jid }, '[CALDERA_DEBUG][LID] phoneNumberShare received');
          this.registerLidMapping(lid, jid);
        }
      });

      this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify' && type !== 'append') return;

        for (const msg of messages) {
          if (!msg.message || !msg.key?.id) continue;

          // Message ID deduplication to prevent double-reply on multi-device sync
          if (this.processedMsgIds.has(msg.key.id)) continue;
          this.processedMsgIds.add(msg.key.id);
          if (this.processedMsgIds.size > 1000) {
            const first = this.processedMsgIds.values().next().value;
            if (first) this.processedMsgIds.delete(first);
          }

          // Skip old history sync messages (type === 'append') to ensure clean startup, but never drop live notify messages
          if (type === 'append') {
            let timestamp: number | undefined;
            if (typeof msg.messageTimestamp === 'number') {
              timestamp = msg.messageTimestamp;
            } else if (typeof (msg.messageTimestamp as any)?.toNumber === 'function') {
              timestamp = (msg.messageTimestamp as any).toNumber();
            } else if (typeof (msg.messageTimestamp as any)?.low === 'number') {
              timestamp = (msg.messageTimestamp as any).low;
            }
            if (timestamp && Date.now() / 1000 - timestamp > 300) {
              continue;
            }
          }

          // Detect "delete for everyone" protocol messages delivered via messages.upsert
          const protoMsg =
            msg.message?.protocolMessage ||
            (msg.message as any)?.ephemeralMessage?.message?.protocolMessage ||
            (msg.message as any)?.viewOnceMessage?.message?.protocolMessage ||
            (msg.message as any)?.viewOnceMessageV2?.message?.protocolMessage;

          if (
            protoMsg &&
            (protoMsg.type === proto.Message.ProtocolMessage.Type.REVOKE ||
              protoMsg.type === 0 ||
              (protoMsg as any).type === 'REVOKE')
          ) {
            const deletedKey = protoMsg.key;
            const deletedId = deletedKey?.id;
            if (deletedId) {
              logger.info(
                { deletedId, chatId: deletedKey?.remoteJid || msg.key?.remoteJid },
                '[REVOKE] Delete-for-everyone detected via ProtocolMessage in messages.upsert'
              );
              try {
                const event = this.buildDeletedMessageEvent(deletedId, deletedKey as any);
                if (event) {
                  this.emitDeletedMessage(event);
                }
              } catch (err) {
                logger.error({ err, deletedId }, 'Error processing protocol REVOKE message');
              }
              continue; // Do not process protocol REVOKE as a normal message
            }
          }

          this.cacheMessage(msg.key.id, msg);

          const msgKey = msg.key as any;
          const contextInfo = extractContextInfo(msg.message);
          logger.info(
            {
              remoteJid: msgKey.remoteJid,
              participant: msgKey.participant,
              participantAlt: msgKey.participantAlt,
              remoteJidAlt: msgKey.remoteJidAlt,
              fromMe: msgKey.fromMe,
              messageId: msgKey.id,
              type,
              contextInfo: {
                participant: contextInfo.participant,
                remoteJid: contextInfo.remoteJid,
                mentionedJid: contextInfo.mentionedJid,
                isForwarded: contextInfo.isForwarded,
                businessOwnerJid: contextInfo.businessOwnerJid,
                hasQuotedMessage: !!contextInfo.quotedMessage,
              },
              senderPn: (msg as any).senderPn,
              participantPn: (msg as any).participantPn,
            },
            '[CALDERA_DEBUG][INCOMING]'
          );

          const normalized = this.normalizeMessage(msg);
          if (!normalized) continue;

          const env = getEnv();
          if (env.MESSAGE_LOGGING) {
            logger.info({ id: normalized.id, sender: normalized.senderNumber }, 'Processing incoming message');
          } else {
            logger.info({ id: normalized.id }, 'Processing incoming message (content redacted)');
          }

          // Bounded message-history emission (persistence + content retention decided dynamically by handler).
          if (this.historyHandlers.size > 0) {
            const unwrapped = unwrapMessageContent(msg.message) || msg.message;
            const historyEvent: HistoryMessageEvent = {
              messageId: normalized.id,
              chatId: normalized.chatId,
              senderJid: normalized.senderJid,
              senderNumber: normalized.senderNumber,
              fromMe: normalized.fromMe,
              isGroup: normalized.isGroup,
              messageType: getMessageBodyType(unwrapped),
              body: normalized.body || undefined,
              hasMedia: normalized.hasMedia,
              mediaType: normalized.mediaType,
              isViewOnce: normalized.isViewOnce,
              timestamp: messageTimestampMs(msg),
            };
            for (const handler of this.historyHandlers) {
              try {
                await handler(historyEvent);
              } catch (err) {
                logger.error({ err, id: normalized.id }, 'Error executing message-history handler');
              }
            }
          }

          for (const handler of this.messageHandlers) {
            try {
              await handler(normalized);
            } catch (err) {
              logger.error({ err, id: normalized.id }, 'Error executing message handler');
            }
          }
        }
      });

      // Detect "delete for everyone" (REVOKE) events. Baileys surfaces these as a
      // messages.update whose update.messageStubType === WebMessageInfo.StubType.REVOKE
      // and whose key.id is the ORIGINAL (deleted) message id. The original content is
      // NOT included in the event — it is only recoverable from our local bounded cache.
      this.socket.ev.on('messages.update', async (updates) => {
        for (const { key, update } of updates) {
          // Handle both direct and nested update shapes across Baileys versions
          const stubType =
            (update as any)?.messageStubType ??
            (update as any)?.update?.messageStubType;
          if (stubType !== proto.WebMessageInfo.StubType.REVOKE) continue;
          const deletedId = key?.id;
          if (!deletedId) continue;
          logger.info({ deletedId, chatId: key?.remoteJid }, '[REVOKE] Delete-for-everyone detected');
          try {
            const event = this.buildDeletedMessageEvent(deletedId, key as any);
            if (!event) {
              logger.warn({ deletedId }, '[REVOKE] No cached message found — metadata only');
              continue;
            }
            this.emitDeletedMessage(event);
          } catch (err) {
            logger.error({ err, deletedId }, 'Error processing REVOKE update');
          }
        }
      });
    } catch (err) {
      logger.error(err, 'Failed to initialize WhatsApp connection');
      this.setStatus('DISCONNECTED');
      throw err;
    }
  }

  public async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.socket) {
      await this.connect();
    }
    if (!this.socket) {
      throw new Error('Failed to initialize WhatsApp socket');
    }
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const code = await this.socket.requestPairingCode(cleanNumber);
    this.setStatus('PAIRING');
    return code;
  }

  public async disconnect(): Promise<void> {
    this.isExplicitDisconnect = true;
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.ev.removeAllListeners('messages.upsert');
        this.socket.end(undefined);
      } catch {}
      this.socket = null;
    }
    await clearFirebaseAuthState(this.sessionKey);
    this.setStatus('DISCONNECTED');
  }

  public async sendMessage(chatId: string, content: string | { text: string }): Promise<any> {
    if (!this.socket || this.status !== 'CONNECTED') {
      logger.error(
        { success: false, messageId: null, error: 'client not connected', chatId },
        '[CALDERA_DEBUG][SEND_RESULT]'
      );
      throw new Error('WhatsApp client is not connected');
    }
    const payload = typeof content === 'string' ? { text: content } : content;
    try {
      const result = await this.socket.sendMessage(chatId, payload);
      logger.info(
        { success: true, messageId: result?.key?.id, error: null, chatId },
        '[CALDERA_DEBUG][SEND_RESULT]'
      );
      return result;
    } catch (err) {
      logger.error(
        { success: false, messageId: null, error: (err as Error)?.message, chatId },
        '[CALDERA_DEBUG][SEND_RESULT]'
      );
      throw err;
    }
  }

  public async sendMedia(
    chatId: string,
    media: Buffer,
    type: 'image' | 'video' | 'audio' | 'sticker',
    options: { caption?: string; fileName?: string; mimetype?: string } = {}
  ): Promise<any> {
    if (!this.socket || this.status !== 'CONNECTED') {
      throw new Error('WhatsApp client is not connected');
    }

    if (type === 'image') {
      return await this.socket.sendMessage(chatId, { image: media, caption: options.caption });
    } else if (type === 'video') {
      return await this.socket.sendMessage(chatId, { video: media, caption: options.caption });
    } else if (type === 'audio') {
      return await this.socket.sendMessage(chatId, { audio: media, mimetype: options.mimetype || 'audio/mp4' });
    } else if (type === 'sticker') {
      return await this.socket.sendMessage(chatId, { sticker: media });
    }
  }

  public async downloadMedia(msg: proto.IWebMessageInfo): Promise<Buffer> {
    try {
      const ctx = this.socket?.updateMediaMessage
        ? {
            logger: logger as any,
            reuploadRequest: this.socket.updateMediaMessage.bind(this.socket),
          }
        : undefined;
      return (await downloadMediaMessage(msg as any, 'buffer', {}, ctx)) as Buffer;
    } catch (err) {
      if (msg.message) {
        return await this.downloadMediaFromContent(msg.message);
      }
      throw err;
    }
  }

  public async downloadMediaFromContent(content: proto.IMessage): Promise<Buffer> {
    const unwrapped = unwrapMessageContent(content) || content;
    const mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null =
      unwrapped.imageMessage ? 'image' :
      unwrapped.videoMessage ? 'video' :
      unwrapped.audioMessage ? 'audio' :
      unwrapped.documentMessage ? 'document' :
      unwrapped.stickerMessage ? 'sticker' : null;

    if (!mediaType) {
      // Try default Baileys wrapper download
      const ctx = this.socket?.updateMediaMessage
        ? {
            logger: logger as any,
            reuploadRequest: this.socket.updateMediaMessage.bind(this.socket),
          }
        : undefined;
      return (await downloadMediaMessage({ message: content, key: {} } as any, 'buffer', {}, ctx)) as Buffer;
    }

    const mediaObj = (unwrapped as any)[`${mediaType}Message`];
    if (!mediaObj) {
      throw new Error(`No ${mediaType} payload found in message content`);
    }

    const stream = await downloadContentFromMessage(mediaObj, mediaType);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  public getCachedMessage(id: string): proto.IWebMessageInfo | undefined {
    const entry = this.recentMessages.get(id);
    if (!entry) return undefined;
    const ts = messageTimestampMs(entry);
    if (ts > 0 && Date.now() - ts > WhatsAppClient.MESSAGE_CACHE_TTL_MS) {
      this.recentMessages.delete(id);
      return undefined;
    }
    return entry;
  }

  /** Bounded snapshot of cached messages, newest first. */
  public getRecentMessages(limit = 100): proto.IWebMessageInfo[] {
    return [...this.recentMessages.values()]
      .sort((a, b) => messageTimestampMs(b) - messageTimestampMs(a))
      .slice(0, Math.max(1, Math.min(limit, WhatsAppClient.MAX_CACHED_MESSAGES)));
  }

  /** Bounded snapshot of cached messages for a single chat, newest first. */
  public getChatMessages(chatId: string, limit = 100): proto.IWebMessageInfo[] {
    return [...this.recentMessages.values()]
      .filter((m) => m.key?.remoteJid === chatId)
      .sort((a, b) => messageTimestampMs(b) - messageTimestampMs(a))
      .slice(0, Math.max(1, Math.min(limit, WhatsAppClient.MAX_CACHED_MESSAGES_PER_CHAT)));
  }

  private cacheMessage(id: string, msg: proto.IWebMessageInfo): void {
    const now = Date.now();
    const chatId = msg.key?.remoteJid || '';

    // Age-based eviction when at capacity — keeps the window bounded.
    if (this.recentMessages.size >= WhatsAppClient.MAX_CACHED_MESSAGES) {
      for (const [k, v] of this.recentMessages) {
        const ts = messageTimestampMs(v);
        if (ts > 0 && now - ts > WhatsAppClient.MESSAGE_CACHE_TTL_MS) {
          this.recentMessages.delete(k);
        }
      }
    }

    this.recentMessages.set(id, msg);

    // Per-chat bound: never hold more than MAX per chat; drop the oldest of that chat.
    if (chatId) {
      let chatCount = 0;
      let oldestChatKey: string | null = null;
      let oldestChatTs = Infinity;
      for (const [k, v] of this.recentMessages) {
        if (v.key?.remoteJid !== chatId) continue;
        chatCount++;
        const ts = messageTimestampMs(v);
        if (ts < oldestChatTs) {
          oldestChatTs = ts;
          oldestChatKey = k;
        }
      }
      while (
        chatCount > WhatsAppClient.MAX_CACHED_MESSAGES_PER_CHAT &&
        oldestChatKey !== null &&
        oldestChatKey !== id
      ) {
        this.recentMessages.delete(oldestChatKey);
        chatCount--;
        oldestChatKey = null;
        oldestChatTs = Infinity;
        for (const [k, v] of this.recentMessages) {
          if (v.key?.remoteJid !== chatId) continue;
          const ts = messageTimestampMs(v);
          if (ts < oldestChatTs) {
            oldestChatTs = ts;
            oldestChatKey = k;
          }
        }
      }
    }

    // Hard overall bound.
    if (this.recentMessages.size > WhatsAppClient.MAX_CACHED_MESSAGES) {
      const oldest = this.recentMessages.keys().next().value;
      if (oldest !== undefined) {
        this.recentMessages.delete(oldest);
      }
    }
  }

  /**
   * Build a DeletedMessageEvent from a REVOKE update.
   * Content is recovered ONLY from the local bounded cache — never fabricated.
   */
  private buildDeletedMessageEvent(
    deletedId: string,
    updateKey?: {
      id?: string | null;
      remoteJid?: string | null;
      fromMe?: boolean | null;
      participant?: string | null;
    } | null
  ): DeletedMessageEvent | null {
    const cached = this.getCachedMessage(deletedId);
    const chatId = cached?.key?.remoteJid || updateKey?.remoteJid || '';
    if (!chatId) return null;
    const deletedAt = Math.floor(Date.now() / 1000);

    if (cached) {
      const normalized = this.normalizeMessage(cached);
      const content = extractRecoveredContent(cached);
      return {
        deletedMessageId: deletedId,
        chatId,
        senderJid: normalized?.senderJid || cached.key?.remoteJid || chatId,
        senderNumber: normalized?.senderNumber || chatId.split('@')[0].split(':')[0],
        senderResolved: normalized?.senderResolved ?? true,
        fromMe: normalized?.fromMe ?? !!cached.key?.fromMe,
        ...content,
        deletedAt,
      };
    }

    // No cached copy — metadata only. Honest: we do not have the original content.
    const fallback = extractFallbackIdentity(updateKey, chatId);
    return {
      deletedMessageId: deletedId,
      chatId,
      ...fallback,
      messageType: 'unknown',
      hasMedia: false,
      deletedAt,
      contentAvailable: false,
    };
  }

  private normalizeMessage(msg: proto.IWebMessageInfo): NormalizedMessage | null {
    const key = msg.key;
    if (!key || !key.remoteJid) return null;

    const messageContent = msg.message;
    if (!messageContent) return null;

    const finalContent = unwrapMessageContent(messageContent);
    if (!finalContent) return null;

    const isViewOnce = isViewOnceMessage(messageContent);

    let body =
      finalContent.conversation ||
      finalContent.extendedTextMessage?.text ||
      finalContent.imageMessage?.caption ||
      finalContent.videoMessage?.caption ||
      finalContent.documentMessage?.caption ||
      finalContent.buttonsResponseMessage?.selectedButtonId ||
      finalContent.buttonsResponseMessage?.selectedDisplayText ||
      finalContent.templateButtonReplyMessage?.selectedId ||
      finalContent.templateButtonReplyMessage?.selectedDisplayText ||
      finalContent.listResponseMessage?.singleSelectReply?.selectedRowId ||
      finalContent.listResponseMessage?.title ||
      '';

    let hasMedia = false;
    let mediaType: NormalizedMessage['mediaType'] = undefined;

    if (finalContent.imageMessage) {
      hasMedia = true;
      mediaType = 'image';
    } else if (finalContent.videoMessage) {
      hasMedia = true;
      mediaType = 'video';
    } else if (finalContent.audioMessage) {
      hasMedia = true;
      mediaType = 'audio';
    } else if (finalContent.stickerMessage) {
      hasMedia = true;
      mediaType = 'sticker';
    } else if (finalContent.documentMessage) {
      hasMedia = true;
      mediaType = 'document';
    }

    // Resolve real Phone Number JID vs WhatsApp Privacy LID.
    // Priority:
    //   1. Explicit sender_pn from the raw CB:message node (incoming only, by message ID)
    //   2. Known LID -> PN mapping (learned via phoneNumberShare/contacts)
    //   3. Existing normal PN JID on the message
    //   4. Retain LID as-is (fallback)
    const primaryJid = key.participant || key.remoteJid;
    const rawSenderPn = !key.fromMe ? this.getCachedSenderPn(key.id) : undefined;
    let phoneJid = primaryJid;
    let senderNumber = primaryJid.split('@')[0].split(':')[0];
    // Whether senderNumber is a verified phone identity (used by authorization).
    let senderResolved = true;

    if (rawSenderPn) {
      phoneJid = rawSenderPn;
      senderNumber = rawSenderPn.split('@')[0].split(':')[0].replace(/\D/g, '');
      senderResolved = true;
      logger.info(
        {
          rawSenderPn,
          resolvedSenderJid: phoneJid,
          resolvedSenderNumber: senderNumber,
          messageId: key.id,
        },
        '[CALDERA_DEBUG][SENDER_PN]'
      );
    } else if (primaryJid.includes('@lid')) {
      const mappedPn = this.getPnForLid(primaryJid);
      logger.info(
        {
          incomingLid: primaryJid.split('@')[0],
          mappedPn: mappedPn ?? null,
          lidToPnMapSize: this.lidToPnMap.size,
        },
        '[CALDERA_DEBUG][LID]'
      );
      if (!mappedPn) {
        logger.warn(
          { incomingLid: primaryJid.split('@')[0], lidToPnMapSize: this.lidToPnMap.size },
          'LID_MAPPING_MISSING'
        );
      }
      if (mappedPn) {
        phoneJid = `${mappedPn}@s.whatsapp.net`;
        senderNumber = mappedPn;
        senderResolved = true;
        const env = getEnv();
        if (env.MESSAGE_LOGGING) {
          logger.info({ primaryJid, mappedPn, phoneJid }, '[LID] Resolved incoming message');
        }
      } else if (key.remoteJid && key.remoteJid.includes('@s.whatsapp.net')) {
        phoneJid = key.remoteJid;
        senderNumber = phoneJid.split('@')[0].split(':')[0];
        senderResolved = true;
      } else if (key.participant && key.participant.includes('@s.whatsapp.net')) {
        phoneJid = key.participant;
        senderNumber = phoneJid.split('@')[0].split(':')[0];
        senderResolved = true;
      } else {
        // LID present but no phone mapping available — authorization MUST fail closed.
        phoneJid = primaryJid;
        senderNumber = primaryJid.split('@')[0].split(':')[0];
        senderResolved = false;
      }
    } else {
      senderNumber = phoneJid.split('@')[0].split(':')[0];
      senderResolved = true;
    }

    const senderJid = phoneJid;

    logger.info(
      {
        senderJid: phoneJid,
        senderNumber,
        chatId: key.remoteJid,
        bodyType: getMessageBodyType(finalContent),
      },
      '[CALDERA_DEBUG][NORMALIZED]'
    );

    return {
      id: key.id || '',
      chatId: key.remoteJid,
      senderJid,
      senderNumber,
      senderResolved,
      pushName: msg.pushName || undefined,
      fromMe: !!key.fromMe,
      isGroup: Boolean(isJidGroup(key.remoteJid)),
      body,
      hasMedia,
      mediaType,
      isViewOnce,
      rawMessage: msg,
    };
  }
}
