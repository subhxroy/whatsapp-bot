import { CommandPlugin } from '../types';
import { db } from '@private-md-bot/database';

export const antilinkCommand: CommandPlugin = {
  name: 'antilink',
  aliases: ['nolink'],
  description: 'Toggle anti-link group protection (delete chat links)',
  category: 'admin',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    if (!ctx.message.isGroup) {
      return await ctx.reply('âŒ This command can only be used in group chats.');
    }

    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('â›” Only group admins or bot owner can configure anti-link settings.');
    }

    const state = ctx.args[0]?.toLowerCase();
    const key = `antilink_${ctx.message.chatId}`;

    if (state === 'on' || state === 'enable') {
      await db.upsertSetting({ key, value: 'true', description: 'Anti-link enabled for group' });
      await ctx.reply('ðŸ›¡ï¸ Anti-Link protection *ENABLED* for this group.');
    } else if (state === 'off' || state === 'disable') {
      await db.upsertSetting({ key, value: 'false', description: 'Anti-link disabled for group' });
      await ctx.reply('ðŸ›¡ï¸ Anti-Link protection *DISABLED* for this group.');
    } else {
      await ctx.reply(`Usage: \`${ctx.prefix}antilink <on|off>\``);
    }
  },
};
