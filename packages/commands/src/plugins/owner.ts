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

    const text = `ðŸ‘‘ *CALDERA BOT â€” CREATOR & DEVELOPER*
â€¢ *Creator:* Subhankar Roy
â€¢ *Portfolio:* https://subhankar.vercel.app
â€¢ *Email:* contact.subhroy@gmail.com / aarxslan@gmail.com
â€¢ *WhatsApp:* https://wa.me/${cleanNum}

_Private & Secure WhatsApp Automation Control Center._`;

    await ctx.reply(text);
  },
};
