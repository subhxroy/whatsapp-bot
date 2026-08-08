import { CommandPlugin } from '../types';
import { getEnv } from '@private-md-bot/config';

export const ownerCommand: CommandPlugin = {
  name: 'owner',
  aliases: ['creator', 'admin'],
  description: 'Display bot owner contact details',
  category: 'general',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const env = getEnv();
    const ownerNum = env.BOT_OWNER_NUMBER || 'Configured in server environment';
    await ctx.reply(`👑 *Bot Owner / Administrator:* wa.me/${ownerNum.replace(/\D/g, '')}`);
  },
};
