import { CommandPlugin } from '../types';

export const aboutCommand: CommandPlugin = {
  name: 'about',
  aliases: ['info', 'version'],
  description: 'Display bot security and creator details',
  category: 'general',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const text = `ðŸ”¥ *CALDERA BOT â€” CONTROL CENTER*
â€¢ *Creator:* Subhankar Roy
â€¢ *Portfolio:* https://subhankar.vercel.app
â€¢ *Security:* End-to-End Encrypted Session Keys
â€¢ *Privacy:* Zero 3rd-Party Tracking | Zero Telemetry
â€¢ *Activation Fee:* â‚¹200 One-Time Access

_Private, self-hosted WhatsApp automation for power users._`;

    await ctx.reply(text);
  },
};
