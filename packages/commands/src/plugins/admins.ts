import { CommandPlugin } from '../types';

export const adminsCommand: CommandPlugin = {
  name: 'admins',
  aliases: ['adminlist', 'groupadmins'],
  description: 'List all group administrators in current chat',
  category: 'group',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    if (!ctx.message.isGroup) {
      return await ctx.reply('âŒ This command can only be used inside group chats.');
    }

    const groupMeta = await ctx.getGroupMetadata();
    if (!groupMeta) {
      return await ctx.reply('âŒ Could not fetch group metadata.');
    }

    const admins = groupMeta.participants.filter(
      (p: any) => p.admin === 'admin' || p.admin === 'superadmin'
    );

    if (admins.length === 0) {
      return await ctx.reply('ðŸ‘¥ No admins found in this group.');
    }

    let text = `ðŸ›¡ï¸ *GROUP ADMINISTRATORS LIST*\n` +
               `â€¢ *Group:* ${groupMeta.subject}\n` +
               `â€¢ *Total Admins:* ${admins.length}\n\n`;

    admins.forEach((admin: any, idx: number) => {
      const num = admin.id.split('@')[0];
      const role = admin.admin === 'superadmin' ? 'ðŸ‘‘ Creator' : 'âš¡ Admin';
      text += `${idx + 1}. +${num} (${role})\n`;
    });

    await ctx.reply(text);
  },
};
