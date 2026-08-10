import { CommandPlugin } from '../types';

export const toGifCommand: CommandPlugin = {
  name: 'togif',
  aliases: ['gif'],
  description: 'Convert quoted video or animated sticker to GIF playback',
  category: 'media',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const hasQuote = !!ctx.message.rawMessage?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!hasQuote) {
      return await ctx.reply(`ðŸŽ¬ *Usage:* Reply to a video or animated sticker with \`${ctx.prefix}togif\``);
    }

    await ctx.reply('â³ *Processing GIF conversion...*');

    try {
      const mediaBuffer = await ctx.downloadQuotedMedia();
      if (!mediaBuffer || mediaBuffer.length === 0) {
        return await ctx.reply('âŒ Could not download quoted media.');
      }

      await ctx.replyWithVideo(mediaBuffer, 'video/mp4', true);
    } catch (err: any) {
      await ctx.reply(`âŒ GIF conversion failed: ${err.message || 'Error processing media'}`);
    }
  },
};
