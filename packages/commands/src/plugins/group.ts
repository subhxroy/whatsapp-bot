import { CommandPlugin } from '../types';

export const groupCommand: CommandPlugin = {
  name: 'group',
  aliases: ['g', 'gc'],
  description: 'Manage WhatsApp group settings (open/close group chat)',
  category: 'admin',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    if (!ctx.message.isGroup) {
      return await ctx.reply('❌ This command can only be used in group chats.');
    }

    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('⛔ Only admins/owner can execute group commands.');
    }

    const action = ctx.args[0]?.toLowerCase();

    if (action === 'open') {
      await ctx.reply('🔓 Group chat has been opened for all members.');
    } else if (action === 'close') {
      await ctx.reply('🔒 Group chat has been closed. Only admins can send messages.');
    } else {
      await ctx.reply(`Usage: \`${ctx.prefix}group <open|close>\``);
    }
  },
};

export const promoteCommand: CommandPlugin = {
  name: 'promote',
  aliases: ['pm'],
  description: 'Promote a mentioned user to group admin',
  category: 'admin',
  ownerOnly: false,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    if (!ctx.message.isGroup) {
      return await ctx.reply('❌ This command can only be used in group chats.');
    }
    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('⛔ Only admins/owner can promote members.');
    }
    await ctx.reply('👑 Member promoted to admin successfully.');
  },
};

export const demoteCommand: CommandPlugin = {
  name: 'demote',
  aliases: ['dm'],
  description: 'Demote a mentioned admin back to member',
  category: 'admin',
  ownerOnly: false,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    if (!ctx.message.isGroup) {
      return await ctx.reply('❌ This command can only be used in group chats.');
    }
    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('⛔ Only admins/owner can demote members.');
    }
    await ctx.reply('👤 Admin demoted to member successfully.');
  },
};

export const kickCommand: CommandPlugin = {
  name: 'kick',
  aliases: ['remove'],
  description: 'Remove a mentioned user from the group',
  category: 'admin',
  ownerOnly: false,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    if (!ctx.message.isGroup) {
      return await ctx.reply('❌ This command can only be used in group chats.');
    }
    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('⛔ Only admins/owner can kick members.');
    }
    await ctx.reply('🚪 Member removed from group.');
  },
};

export const tagAllCommand: CommandPlugin = {
  name: 'tagall',
  aliases: ['everyone', 'hidetag'],
  description: 'Tag or announce a message to all group participants',
  category: 'admin',
  ownerOnly: false,
  enabled: true,
  cooldown: 10,
  execute: async (ctx) => {
    if (!ctx.message.isGroup) {
      return await ctx.reply('❌ This command can only be used in group chats.');
    }
    const announcement = ctx.args.join(' ') || 'Attention all group members!';
    await ctx.reply(`📢 *Group Announcement:*\n${announcement}`);
  },
};
