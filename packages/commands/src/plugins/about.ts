import { CommandPlugin } from '../types';

export const aboutCommand: CommandPlugin = {
  name: 'about',
  aliases: ['info', 'version'],
  description: 'Display architecture details, security policies, and software specifications',
  category: 'general',
  ownerOnly: true,
  cooldown: 3,
  enabled: true,
  execute: async (ctx) => {
    const text = `\u{1F451} *CALDERA BOT — CONTROL CENTER*\n` +
      `\u2022 *Creator:* Subhankar Roy\n` +
      `\u2022 *Portfolio:* https://subhankar.vercel.app\n` +
      `\u2022 *Security:* End-to-End Encrypted Session Keys\n` +
      `\u2022 *Privacy:* Zero 3rd-Party Tracking | Zero Telemetry\n` +
      `\u2022 *Activation Fee:* ₹1200 One-Time Access`;

    await ctx.reply(text);
  },
};
