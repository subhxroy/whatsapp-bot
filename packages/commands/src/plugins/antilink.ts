import { CommandPlugin } from '../types';

export const antilinkCommand: CommandPlugin = {
  name: 'antilink',
  aliases: ['linkprotect'],
  description: 'Toggle anti-link group protection mode (Admin-Only)',
  category: 'group',
  ownerOnly: true,
  cooldown: 5,
  groupOnly: true,
  adminOnly: true,
  enabled: true,
  execute: async (ctx) => {
    if (!ctx.isGroup) {
      return await ctx.reply('\u{26A0}\uFE0F This command can only be used in group chats.');
    }

    if (!ctx.isAdmin && !ctx.isOwner) {
      return await ctx.reply('\u{26A0}\uFE0F Only group admins or bot owner can configure anti-link settings.');
    }

    const action = (ctx.args[0] || '').toLowerCase();
    const enable = action === '1' || action === 'on' || action === 'enable';

    if (enable) {
      await ctx.reply('\u{1F6E1}\uFE0F Anti-Link protection *ENABLED* for this group.');
    } else {
      await ctx.reply('\u{1F6E1}\uFE0F Anti-Link protection *DISABLED* for this group.');
    }
  },
};
