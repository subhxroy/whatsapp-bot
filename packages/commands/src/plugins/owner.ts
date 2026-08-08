import { CommandPlugin } from '../types';
import { getEnv } from '@private-md-bot/config';

export const ownerCommand: CommandPlugin = {
  name: 'owner',
  aliases: ['creator', 'developer', 'author'],
  description: 'Display bot owner contact and portfolio details',
  category: 'general',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const env = getEnv();
    const ownerNum = env.BOT_OWNER_NUMBER || '919864149429';
    const cleanNum = ownerNum.replace(/\D/g, '');

    const text = `👑 *CALDERA BOT — CREATOR & DEVELOPER*
• *Creator:* Subhankar Roy
• *Portfolio:* https://subhankar.vercel.app
• *Email:* contact.subhroy@gmail.com / aarxslan@gmail.com
• *WhatsApp:* https://wa.me/${cleanNum}

_Private & Secure WhatsApp Automation Control Center._`;

    await ctx.reply(text);
  },
};
