import { CommandPlugin } from '../types';
import { getEnv } from '@private-md-bot/config';

export const ownerCommand: CommandPlugin = {
  name: 'owner',
  aliases: ['creator', 'developer', 'author'],
  description: 'Display bot owner contact and portfolio details',
  category: 'general',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const env = getEnv();
    const ownerNum = env.BOT_OWNER_NUMBER || '919864149429';
    const cleanNum = ownerNum.replace(/\D/g, '');

    const text = `\u{1F451} *CALDERA BOT — CREATOR & DEVELOPER*\n` +
      `\u2022 *Creator:* Subhankar Roy\n` +
      `\u2022 *Portfolio:* https://subhankar.vercel.app\n` +
      `\u2022 *Email:* contact.subhroy@gmail.com / aarxslan@gmail.com\n` +
      `\u2022 *WhatsApp:* https://wa.me/${cleanNum}\n\n` +
      `_Private & Secure WhatsApp Automation Control Center._`;

    await ctx.reply(text);
  },
};
