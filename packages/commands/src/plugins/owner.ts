import { CommandPlugin } from '../types';
import { getEnv } from '@private-md-bot/config';

export const ownerCommand: CommandPlugin = {
  name: 'owner',
  aliases: ['creator', 'developer', 'author'],
  description: 'Display bot owner contact and developer details',
  category: 'general',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const env = getEnv();
    const ownerNum = env.BOT_OWNER_NUMBER || '919864149429';
    const cleanNum = ownerNum.replace(/\D/g, '');

    const text = `👑 *CALDERA BOT — CREATOR & OWNER*
• *Developer:* Subhankar Roy
• *Contact Email:* contact.subhroy@gmail.com / aarxslan@gmail.com
• *WhatsApp Contact:* https://wa.me/${cleanNum}
• *Repository:* https://github.com/subhxroy/whatsapp-bot

_Built with Baileys v6, Fastify, Next.js 15, and Firestore._`;

    await ctx.reply(text);
  },
};
