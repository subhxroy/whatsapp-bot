import { CommandPlugin } from '../types';

export const antilinkCommand: CommandPlugin = {
  name: 'antilink',
  aliases: ['linkprotect'],
  description: 'Toggle anti-link group protection mode (Admin-Only)',
  category: 'group',
  ownerOnly: true,
  cooldown: 5,
  enabled: true,
  execute: async (ctx) => {
    if (!ctx.message.isGroup) {
      return await ctx.reply('⚠️ This command can only be used in group chats.');
    }

    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('⚠️ Only group admins or bot owner can configure anti-link settings.');
    }

    const action = (ctx.args[0] || '').toLowerCase();
    const enable = action === '1' || action === 'on' || action === 'enable';

    if (enable) {
      await ctx.reply('🛡️ Anti-Link protection *ENABLED* for this group.');
    } else {
      await ctx.reply('🛡️ Anti-Link protection *DISABLED* for this group.');
    }
  },
};
