import { CommandPlugin } from '../types';

export const idCommand: CommandPlugin = {
  name: 'id',
  aliases: ['jid', 'chatid'],
  description: 'Display chat and sender WhatsApp JID metadata',
  category: 'utility',
  ownerOnly: false,
  enabled: true,
  cooldown: 2,
  execute: async (ctx) => {
    const isGroup = ctx.message.isGroup;
    const text =
      `🆔 *WHATSAPP IDENTIFIER METADATA*\n` +
      `• *Chat JID:* \`${ctx.message.chatId}\`\n` +
      `• *Sender JID:* \`${ctx.message.senderJid}\`\n` +
      `• *Sender Number:* +${ctx.message.senderNumber}\n` +
      `• *Chat Type:* ${isGroup ? 'Group Chat 👥' : 'Direct Message 👤'}`;

    await ctx.reply(text);
  },
};
