import { CommandPlugin } from '../types';
import { stickerToImage } from '@private-md-bot/media';

export const toImgCommand: CommandPlugin = {
  name: 'toimg',
  aliases: ['toimage', 'stiker2img'],
  description: 'Convert a sticker into a PNG image',
  category: 'media',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const msg = ctx.message;

    if (msg.isViewOnce) {
      return await ctx.reply('âŒ View-once media cannot be extracted or converted.');
    }

    if (!msg.hasMedia || msg.mediaType !== 'sticker') {
      return await ctx.reply('âŒ Please reply to a sticker with `.toimg`.');
    }

    await ctx.reply('â³ Converting sticker to image...');

    try {
      const stickerBuffer = await ctx.client.downloadMedia(msg.rawMessage);
      const imgBuffer = await stickerToImage(stickerBuffer);

      await ctx.replyMedia(imgBuffer, 'image', { caption: 'ðŸ–¼ï¸ Converted image' });
    } catch (err: any) {
      await ctx.reply(`âŒ Failed to convert sticker to image: ${err.message || 'Media processing error'}`);
    }
  },
};
