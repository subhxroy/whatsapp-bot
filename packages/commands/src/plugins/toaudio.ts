import { CommandPlugin } from '../types';
import { extractAudioFromVideo } from '@private-md-bot/media';

export const toAudioCommand: CommandPlugin = {
  name: 'toaudio',
  aliases: ['tomp3', 'mp3'],
  description: 'Convert quoted video or audio message to MP3 audio format',
  category: 'media',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const quoted = ctx.message.quoted;
    if (!quoted) {
      return await ctx.reply(`🎵 *Usage:* Reply to a video or voice message with \`${ctx.prefix}toaudio\``);
    }

    await ctx.reply('⏳ *Converting media to audio... Please wait.*');

    try {
      const mediaBuffer = await ctx.downloadQuotedMedia();
      if (!mediaBuffer || mediaBuffer.length === 0) {
        return await ctx.reply('❌ Could not download quoted media snippet.');
      }

      const audioBuffer = await extractAudioFromVideo(mediaBuffer);
      await ctx.replyWithAudio(audioBuffer, 'audio/mp4');
    } catch (err: any) {
      await ctx.reply(`❌ Media conversion failed: ${err.message || 'Format not supported'}`);
    }
  },
};
