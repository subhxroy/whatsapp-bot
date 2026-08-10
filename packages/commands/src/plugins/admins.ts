import { CommandPlugin } from '../types';

export const adminsCommand: CommandPlugin = {
  name: 'admins',
  aliases: ['adminlist', 'tagadmins'],
  description: 'List all group administrators (Group-Only)',
  category: 'group',
  ownerOnly: true,
  cooldown: 5,
  groupOnly: true,
  enabled: true,
  execute: async (ctx) => {
    if (!ctx.isGroup) {
      return await ctx.reply('\u{26A0}\uFE0F This command can only be used inside group chats.');
    }

    const groupMeta = await ctx.client.getGroupMetadata(ctx.chatId);
    if (!groupMeta) {
      return await ctx.reply('\u{26A0}\uFE0F Could not fetch group metadata.');
    }

    const admins = groupMeta.participants.filter(
      (p) => p.admin === 'admin' || p.admin === 'superadmin'
    );

    if (admins.length === 0) {
      return await ctx.reply('\u{1F641} No admins found in this group.');
    }

    let text = `\u{1F451} *GROUP ADMINISTRATORS LIST*\n` +
               `\u2022 *Group:* ${groupMeta.subject}\n` +
               `\u2022 *Total Admins:* ${admins.length}\n\n`;

    for (const admin of admins) {
      const num = admin.id.split('@')[0].split(':')[0];
      const role = admin.admin === 'superadmin' ? '\u{1F451} Creator' : '\u{1F6E1}\uFE0F Admin';
      text += `\u2022 @${num} — ${role}\n`;
    }

    await ctx.reply(text);
  },
};
