import { CommandPlugin } from '../types';

const extractViewOnce = (content: any): any => {
  if (!content) return null;
  return (
    content.viewOnceMessage?.message ||
    content.viewOnceMessageV2?.message ||
    content.viewOnceMessageV2Extension?.message ||
    content
  );
};

const getMediaType = (content: any): 'image' | 'video' | 'audio' | null => {
  if (content?.imageMessage) return 'image';
  if (content?.videoMessage) return 'video';
  if (content?.audioMessage) return 'audio';
  return null;
};

export const vvCommand: CommandPlugin = {
  name: 'vv',
  aliases: ['avv'],
  description: 'Silently reveal view-once media by replying to it',
  category: 'media',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const contextInfo = ctx.message.rawMessage?.message?.extendedTextMessage?.contextInfo;
    const quotedContent = contextInfo?.quotedMessage;
    const quotedId = contextInfo?.stanzaId;

    if (!quotedContent) {
      return await ctx.reply('❌ Reply to a view-once image, video, or audio message with `.vv` to reveal it.');
    }

    // Prefer the originally received message (keeps full media keys/directPath,
    // which WhatsApp strips from quoted view-once content).
    let cachedMsg: any;
    let inner: any = extractViewOnce(quotedContent);

    if (quotedId) {
      const cached = ctx.client.getCachedMessage(quotedId);
      const cachedInner = cached?.message
        ? (cached.message.viewOnceMessage?.message ||
            cached.message.viewOnceMessageV2?.message ||
            cached.message.viewOnceMessageV2Extension?.message ||
            cached.message)
        : undefined;

      if (cachedInner && getMediaType(cachedInner)) {
        cachedMsg = cached;
        inner = cachedInner;
      }
    }

    const mediaType = getMediaType(inner);
    if (!mediaType) {
      return await ctx.reply('❌ Quoted message is not view-once media (image, video, or audio).');
    }

    try {
      const buffer = cachedMsg
        ? await ctx.client.downloadMedia(cachedMsg)
        : await ctx.client.downloadMediaFromContent(inner);

      await ctx.replyMedia(buffer, mediaType, {
        caption: mediaType !== 'audio' ? '🔓 Revealed view-once message' : undefined,
      });
    } catch (err: any) {
      await ctx.reply(
        `❌ Failed to reveal view-once media: ${err.message || 'Media expired or download failed'}`
      );
    }
  },
};
