import { CommandPlugin } from '../types';

export const toGifCommand: CommandPlugin = {
  name: 'togif',
  aliases: ['gif'],
  description: 'Convert quoted video or animated sticker to GIF playback',
  category: 'media',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const quoted = ctx.message.quoted;
    if (!quoted) {
      return await ctx.reply(`🎬 *Usage:* Reply to a video or animated sticker with \`${ctx.prefix}togif\``);
    }

    await ctx.reply('⏳ *Processing GIF conversion...*');

    try {
      const mediaBuffer = await ctx.downloadQuotedMedia();
      if (!mediaBuffer || mediaBuffer.length === 0) {
        return await ctx.reply('❌ Could not download quoted media.');
      }

      await ctx.replyWithVideo(mediaBuffer, 'video/mp4', true);
    } catch (err: any) {
      await ctx.reply(`❌ GIF conversion failed: ${err.message || 'Error processing media'}`);
    }
  },
};
