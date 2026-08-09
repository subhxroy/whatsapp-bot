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

  private static readonly MAX_CACHED_MESSAGES = 300;

  constructor(sessionKey: string = 'default_session') {
    this.sessionKey = sessionKey;
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
      throw new Error('WhatsApp client is not connected');
    }
    const payload = typeof content === 'string' ? { text: content } : content;
    return await this.socket.sendMessage(chatId, payload);
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

    // Resolve real Phone Number JID vs WhatsApp Privacy LID
    const primaryJid = key.participant || key.remoteJid;
    let phoneJid = primaryJid;

    const altJid = (key as any).participantAlt || (key as any).remoteJidAlt;
    if (altJid && altJid.includes('@s.whatsapp.net')) {
      phoneJid = altJid;
    } else if (primaryJid.includes('@lid')) {
      if (key.remoteJid && key.remoteJid.includes('@s.whatsapp.net')) {
        phoneJid = key.remoteJid;
      } else if (key.participant && key.participant.includes('@s.whatsapp.net')) {
        phoneJid = key.participant;
      }
    }

    const senderJid = phoneJid;
    const senderNumber = phoneJid.split('@')[0].split(':')[0];

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
