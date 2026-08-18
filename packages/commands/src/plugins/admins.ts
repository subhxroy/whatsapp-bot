import { CommandPlugin, GroupParticipant } from '../types';

export const adminsCommand: CommandPlugin = {
  name: 'admins',
  aliases: ['adminlist', 'tagadmins'],
  description: 'List all group administrators (Group-Only)',
  category: 'group',
  ownerOnly: true,
  cooldown: 5,
  enabled: true,
  execute: async (ctx) => {
    if (!ctx.message.isGroup) {
      return await ctx.reply('⚠️ This command can only be used inside group chats.');
    }

    const groupMeta = await ctx.getGroupMetadata();
    if (!groupMeta) {
      return await ctx.reply('⚠️ Could not fetch group metadata.');
    }

    const admins = groupMeta.participants.filter(
      (p: GroupParticipant) => p.admin === 'admin' || p.admin === 'superadmin'
    );

    if (admins.length === 0) {
      return await ctx.reply('🙁 No admins found in this group.');
    }

    let text =
      `👑 *GROUP ADMINISTRATORS LIST*\n` +
      `• *Group:* ${groupMeta.subject}\n` +
      `• *Total Admins:* ${admins.length}\n\n`;

    for (const admin of admins) {
      const num = admin.id.split('@')[0].split(':')[0];
      const role = admin.admin === 'superadmin' ? '👑 Creator' : '🛡️ Admin';
      text += `• @${num} — ${role}\n`;
    }

    await ctx.reply(text);
  },
};
