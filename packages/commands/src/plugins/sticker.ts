import { CommandPlugin } from '../types';
import { imageToSticker, videoToSticker } from '@private-md-bot/media';

export const stickerCommand: CommandPlugin = {
  name: 'sticker',
  aliases: ['s', 'stiker'],
  description: 'Convert attached image or video to a WhatsApp sticker',
  category: 'media',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const msg = ctx.message;

    if (msg.isViewOnce) {
      return await ctx.reply('âŒ View-once media is protected and cannot be converted into a sticker.');
    }

    if (!msg.hasMedia || (msg.mediaType !== 'image' && msg.mediaType !== 'video')) {
      return await ctx.reply('âŒ Please send or reply to an image or short video with `.sticker`.');
    }

    await ctx.reply('â³ Processing media into sticker...');

    try {
      const mediaBuffer = await ctx.client.downloadMedia(msg.rawMessage);
      let stickerBuffer: Buffer;

      if (msg.mediaType === 'image') {
        stickerBuffer = await imageToSticker(mediaBuffer);
      } else {
        stickerBuffer = await videoToSticker(mediaBuffer);
      }

      await ctx.replyMedia(stickerBuffer, 'sticker');
    } catch (err: any) {
      await ctx.reply(`âŒ Failed to create sticker: ${err.message || 'Media processing error'}`);
    }
  },
};
