import type { proto } from '@whiskeysockets/baileys';

/**
 * Pure helpers for deleted-message (REVOKE) handling and message-content
 * extraction. Kept free of socket/client state so the behavior is unit-testable.
 */

export function unwrapMessageContent(msgContent: proto.IMessage | null | undefined): proto.IMessage | null {
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

export function isViewOnceMessage(msgContent: proto.IMessage | null | undefined): boolean {
  if (!msgContent) return false;
  let current: any = msgContent;

  while (current) {
    if (
      current.viewOnceMessage ||
      current.viewOnceMessageV2 ||
      current.viewOnceMessageV2Extension
    ) {
      return true;
    }
    if (
      current.imageMessage?.viewOnce ||
      current.videoMessage?.viewOnce ||
      current.audioMessage?.viewOnce
    ) {
      return true;
    }
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
    } else if (current.deviceSentMessage?.message) {
      current = current.deviceSentMessage.message;
    } else if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message;
    } else if (current.editedMessage?.message?.protocolMessage?.editedMessage) {
      current = current.editedMessage.message.protocolMessage.editedMessage;
    } else {
      break;
    }
  }
  return false;
}

export function extractContextInfo(messageContent: proto.IMessage | null | undefined): any {
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

export function getMessageBodyType(content: proto.IMessage): string {
  if (content.conversation) return 'conversation';
  if (content.extendedTextMessage) return 'extendedTextMessage';
  if (content.imageMessage) return 'imageMessage';
  if (content.videoMessage) return 'videoMessage';
  if (content.audioMessage) return 'audioMessage';
  if (content.stickerMessage) return 'stickerMessage';
  if (content.documentMessage) return 'documentMessage';
  if (content.buttonsResponseMessage) return 'buttonsResponseMessage';
  if (content.listResponseMessage) return 'listResponseMessage';
  if (content.protocolMessage) return 'protocolMessage';
  return 'unknown';
}

export function extractMessageBody(finalContent: proto.IMessage | null | undefined): string {
  if (!finalContent) return '';
  return (
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
    ''
  );
}

export function extractQuotedId(messageContent: proto.IMessage | null | undefined): string | undefined {
  if (!messageContent) return undefined;
  const ctx = extractContextInfo(messageContent);
  return ctx?.stanzaId || undefined;
}

export function messageTimestampMs(msg: { messageTimestamp?: any }): number {
  const t = msg?.messageTimestamp;
  if (typeof t === 'number') return t * 1000;
  if (t && typeof (t as any).toNumber === 'function') return (t as any).toNumber() * 1000;
  if (t && typeof (t as any).low === 'number') return (t as any).low * 1000;
  return Date.now();
}

export type DeletedMediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export interface RecoveredContent {
  body?: string;
  messageType: string;
  hasMedia: boolean;
  mediaType?: DeletedMediaType;
  quotedId?: string;
  originalTimestamp?: number;
  contentAvailable: boolean;
}

/** Extract recoverable content/metadata from a cached copy of a now-deleted message. */
export function extractRecoveredContent(cached: proto.IWebMessageInfo): RecoveredContent {
  const finalContent = unwrapMessageContent(cached.message) || cached.message || {};
  const body = extractMessageBody(finalContent).trim();
  const mediaType: DeletedMediaType | undefined = finalContent.imageMessage
    ? 'image'
    : finalContent.videoMessage
      ? 'video'
      : finalContent.audioMessage
        ? 'audio'
        : finalContent.stickerMessage
          ? 'sticker'
          : finalContent.documentMessage
            ? 'document'
            : undefined;
  return {
    body: body || undefined,
    messageType: getMessageBodyType(finalContent),
    hasMedia: !!mediaType,
    mediaType,
    quotedId: extractQuotedId(cached.message),
    originalTimestamp: messageTimestampMs(cached),
    contentAvailable: !!body,
  };
}

export interface RevokeUpdateKey {
  id?: string | null;
  remoteJid?: string | null;
  fromMe?: boolean | null;
  participant?: string | null;
}

/** Identity fallback when the original message is no longer in the cache. */
export function extractFallbackIdentity(updateKey: RevokeUpdateKey | null | undefined, chatId: string): {
  senderJid: string;
  senderNumber: string;
  senderResolved: boolean;
  fromMe: boolean;
} {
  const primaryJid = updateKey?.participant || updateKey?.remoteJid || chatId;
  return {
    senderJid: primaryJid,
    senderNumber: primaryJid.split('@')[0].split(':')[0],
    senderResolved: !primaryJid.includes('@lid'),
    fromMe: !!updateKey?.fromMe,
  };
}
