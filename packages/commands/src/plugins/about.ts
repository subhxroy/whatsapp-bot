import { CommandPlugin } from '../types';

export const aboutCommand: CommandPlugin = {
  name: 'about',
  aliases: ['info', 'version'],
  description: 'Display bot security and creator details',
  category: 'general',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const text = `🔥 *CALDERA BOT — CONTROL CENTER*
• *Creator:* Subhankar Roy
• *Portfolio:* https://subhankar.vercel.app
• *Security:* End-to-End Encrypted Session Keys
• *Privacy:* Zero 3rd-Party Tracking | Zero Telemetry
• *Activation Fee:* ₹200 One-Time Access

_Private, self-hosted WhatsApp automation for power users._`;

    await ctx.reply(text);
  },
};
