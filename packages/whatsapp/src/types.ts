export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'PAIRING';

export interface NormalizedMessage {
  id: string;
  chatId: string;
  senderJid: string;
  senderNumber: string;
  /** True when senderNumber is a verified phone identity (resolved from LID or explicit PN).
   *  False when the sender could only be identified as an unresolved LID. */
  senderResolved: boolean;
  pushName?: string;
  fromMe: boolean;
  isGroup: boolean;
  body: string;
  hasMedia: boolean;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  isViewOnce: boolean;
  quotedMessage?: {
    id: string;
    body?: string;
    hasMedia: boolean;
    mediaType?: string;
  };
  rawMessage: any;
}

export type MessageHandler = (msg: NormalizedMessage) => Promise<void>;
export type StatusHandler = (status: ConnectionStatus, qr?: string) => void;

/** Emitted when WhatsApp reports a message was deleted "for everyone" (REVOKE stub). */
export interface DeletedMessageEvent {
  /** Original (deleted) message id. */
  deletedMessageId: string;
  chatId: string;
  senderJid: string;
  senderNumber: string;
  /** True when the sender identity is a verified phone number (PN, not an unresolved LID). */
  senderResolved: boolean;
  fromMe: boolean;
  messageType: string;
  /** Recovered body ONLY if still available in the local bounded cache — never fabricated. */
  body?: string;
  hasMedia: boolean;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  quotedId?: string;
  originalTimestamp?: number;
  deletedAt: number;
  /** True when the original content was recovered from the local cache. */
  contentAvailable: boolean;
}

export type DeletedMessageHandler = (event: DeletedMessageEvent) => Promise<void>;

/** Metadata snapshot emitted for message-history persistence (content gated by settings). */
export interface HistoryMessageEvent {
  messageId: string;
  chatId: string;
  senderJid: string;
  senderNumber: string;
  fromMe: boolean;
  isGroup: boolean;
  messageType: string;
  body?: string;
  hasMedia: boolean;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  isViewOnce: boolean;
  timestamp: number;
}

export type HistoryMessageHandler = (event: HistoryMessageEvent) => Promise<void>;
