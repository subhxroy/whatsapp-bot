export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'PAIRING';

export interface NormalizedMessage {
  id: string;
  chatId: string;
  senderJid: string;
  senderNumber: string;
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
