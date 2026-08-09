import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
  proto,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { useFirebaseAuthState, clearFirebaseAuthState } from './auth-store';
import { ConnectionStatus, MessageHandler, NormalizedMessage, StatusHandler } from './types';
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
  private isExplicitDisconnect = false;
  private reconnectAttempts = 0;
  private recentMessages: Map<string, proto.IWebMessageInfo> = new Map();
  private processedMsgIds: Set<string> = new Set();
  private sessionKey: string;
  private userId: string | null = null;
  private lidToPnMap = new Map<string, string>();
  private pnToLidMap = new Map<string, string>();

  /** Short-lived bridge: raw CB:message node messageId -> sender_pn (peer phone JID). */
  private senderPnCache = new Map<string, { pn: string; ts: number }>();

  private static readonly MAX_CACHED_MESSAGES = 300;
  private static readonly SENDER_PN_CACHE_TTL_MS = 120_000;

  constructor(sessionKey: string = 'default_session', userId?: string) {
    this.sessionKey = sessionKey;
    this.userId = userId ?? (sessionKey.startsWith('user_') ? sessionKey.replace(/^user_/, '') : sessionKey);
  }

  public getUserId(): string | null {
    return this.userId;
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
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          if (isLoggedOut) {
            logger.warn('WhatsApp session logged out by user — clearing auth store');
            await clearFirebaseAuthState(this.sessionKey);
            this.socket = null;
            this.setStatus('DISCONNECTED');
            setTimeout(() => this.connect(), 500);
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
            this.reconnectAttempts = 0;
          }
        } else if (connection === 'open') {
          logger.info('WhatsApp connection successfully established');
          this.reconnectAttempts = 0;
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

          this.cacheMessage(msg.key.id, msg);

          const msgKey = msg.key as any;
          const contextInfo = this.extractContextInfo(msg.message);
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

          for (const handler of this.messageHandlers) {
            try {
              await handler(normalized);
            } catch (err) {
              logger.error({ err, id: normalized.id }, 'Error executing message handler');
            }
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
    await clearFirebaseAuthState();
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
    return (await downloadMediaMessage(msg as any, 'buffer', {})) as Buffer;
  }

  public async downloadMediaFromContent(content: proto.IMessage): Promise<Buffer> {
    return (await downloadMediaMessage({ message: content } as any, 'buffer', {})) as Buffer;
  }

  public getCachedMessage(id: string): proto.IWebMessageInfo | undefined {
    return this.recentMessages.get(id);
  }

  private cacheMessage(id: string, msg: proto.IWebMessageInfo): void {
    this.recentMessages.set(id, msg);
    if (this.recentMessages.size > WhatsAppClient.MAX_CACHED_MESSAGES) {
      const oldest = this.recentMessages.keys().next().value;
      if (oldest !== undefined) {
        this.recentMessages.delete(oldest);
      }
    }
  }

  private unwrapMessageContent(msgContent: proto.IMessage | null | undefined): proto.IMessage | null {
    if (!msgContent) return null;
    let current: any = msgContent;

    while (current) {
      if (current.ephemeralMessage?.message) {
        current = current.ephemeralMessage.message;
      } else if (current.viewOnceMessage?.message) {
        current = current.viewOnceMessage.message;
      } else if (current.viewOnceMessageV2?.message) {
        current = current.viewOnceMessageV2.message;
      } else if (current.viewOnceMessageV2Extension?.message) {
        current = current.viewOnceMessageV2Extension.message;
      } else if (current.documentWithCaptionMessage?.message) {
        current = current.documentWithCaptionMessage.message;
      } else if (current.deviceSentMessage?.message) {
        current = current.deviceSentMessage.message;
      } else if (current.editedMessage?.message?.protocolMessage?.editedMessage) {
        current = current.editedMessage.message.protocolMessage.editedMessage;
      } else {
        break;
      }
    }
    return current as proto.IMessage;
  }

  private extractContextInfo(messageContent: proto.IMessage | null | undefined): any {
    if (!messageContent) return {};
    const candidates = [
      'extendedTextMessage',
      'imageMessage',
      'videoMessage',
      'audioMessage',
      'documentMessage',
      'stickerMessage',
      'buttonsResponseMessage',
      'listResponseMessage',
    ];
    for (const key of candidates) {
      const sub = (messageContent as any)[key];
      if (sub && sub.contextInfo) return sub.contextInfo;
    }
    return {};
  }

  private getMessageBodyType(content: proto.IMessage): string {
    if (content.conversation) return 'conversation';
    if (content.extendedTextMessage) return 'extendedTextMessage';
    if (content.imageMessage) return 'imageMessage';
    if (content.videoMessage) return 'videoMessage';
    if (content.audioMessage) return 'audioMessage';
    if (content.stickerMessage) return 'stickerMessage';
    if (content.documentMessage) return 'documentMessage';
    if (content.buttonsResponseMessage) return 'buttonsResponseMessage';
    if (content.listResponseMessage) return 'listResponseMessage';
    return 'unknown';
  }

  private normalizeMessage(msg: proto.IWebMessageInfo): NormalizedMessage | null {
    const key = msg.key;
    if (!key || !key.remoteJid) return null;

    const messageContent = msg.message;
    if (!messageContent) return null;

    const finalContent = this.unwrapMessageContent(messageContent);
    if (!finalContent) return null;

    const isViewOnce =
      !!messageContent.viewOnceMessage ||
      !!messageContent.viewOnceMessageV2 ||
      !!messageContent.viewOnceMessageV2Extension;

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

    if (rawSenderPn) {
      phoneJid = rawSenderPn;
      senderNumber = rawSenderPn.split('@')[0].split(':')[0].replace(/\D/g, '');
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
        const env = getEnv();
        if (env.MESSAGE_LOGGING) {
          logger.info({ primaryJid, mappedPn, phoneJid }, '[LID] Resolved incoming message');
        }
      } else if (key.remoteJid && key.remoteJid.includes('@s.whatsapp.net')) {
        phoneJid = key.remoteJid;
        senderNumber = phoneJid.split('@')[0].split(':')[0];
      } else if (key.participant && key.participant.includes('@s.whatsapp.net')) {
        phoneJid = key.participant;
        senderNumber = phoneJid.split('@')[0].split(':')[0];
      }
    } else {
      senderNumber = phoneJid.split('@')[0].split(':')[0];
    }

    const senderJid = phoneJid;

    logger.info(
      {
        senderJid: phoneJid,
        senderNumber,
        chatId: key.remoteJid,
        bodyType: this.getMessageBodyType(finalContent),
      },
      '[CALDERA_DEBUG][NORMALIZED]'
    );

    return {
      id: key.id || '',
      chatId: key.remoteJid,
      senderJid,
      senderNumber,
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
