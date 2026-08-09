import { CommandPlugin } from '../types';

export const idCommand: CommandPlugin = {
  name: 'id',
  aliases: ['jid', 'chatid', 'whoami'],
  description: 'Display chat, sender phone number, and WhatsApp LID metadata',
  category: 'utility',
  cooldown: 2,
  ownerOnly: false,
  enabled: true,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    const isGroup = activeMsg.isGroup;
    const rawKey = activeMsg.rawMessage?.key as any;
    const lidJid = (rawKey?.participant?.includes('@lid') ? rawKey.participant : null) ||
                   (rawKey?.remoteJid?.includes('@lid') ? rawKey.remoteJid : null);

    let text = `🆔 *WHATSAPP IDENTIFIER METADATA*\n\n` +
      `• *Phone Number:* +${activeMsg.senderNumber}\n` +
      `• *Sender JID:* \`${activeMsg.senderJid}\`\n` +
      `• *Chat JID:* \`${activeMsg.chatId}\`\n` +
      `• *Chat Type:* ${isGroup ? 'Group Chat 👥' : 'Direct Message 👤'}`;

    if (lidJid) {
      text += `\n• *WhatsApp LID:* \`${lidJid}\` (Privacy Identifier)`;
    }

    await client.sendMessage(activeMsg.chatId, text);
  },
};
