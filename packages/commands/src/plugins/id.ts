import { CommandPlugin } from '../types';

export const idCommand: CommandPlugin = {
  name: 'id',
  aliases: ['jid', 'chatid', 'whoami'],
  description: 'Display chat, sender phone number, and WhatsApp LID metadata',
  category: 'utility',
  cooldown: 2,
  ownerOnly: false,
  enabled: true,
  handler: async ({ client, msg }) => {
    const isGroup = msg.isGroup;
    const rawKey = msg.rawMessage?.key as any;
    const lidJid = (rawKey?.participant?.includes('@lid') ? rawKey.participant : null) ||
                   (rawKey?.remoteJid?.includes('@lid') ? rawKey.remoteJid : null);

    let text = `🆔 *WHATSAPP IDENTIFIER METADATA*\n\n` +
      `• *Phone Number:* +${msg.senderNumber}\n` +
      `• *Sender JID:* \`${msg.senderJid}\`\n` +
      `• *Chat JID:* \`${msg.chatId}\`\n` +
      `• *Chat Type:* ${isGroup ? 'Group Chat 👥' : 'Direct Message 👤'}`;

    if (lidJid) {
      text += `\n• *WhatsApp LID:* \`${lidJid}\` (Privacy Identifier)`;
    }

    await client.sendMessage(msg.chatId, text);
  },
};
