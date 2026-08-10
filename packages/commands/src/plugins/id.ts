import { CommandPlugin } from '../types';

export const idCommand: CommandPlugin = {
  name: 'id',
  aliases: ['jid', 'chatid', 'whoami'],
  description: 'Display chat, sender phone number, and WhatsApp LID metadata',
  category: 'utility',
  cooldown: 2,
  ownerOnly: true,
  enabled: true,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    const isGroup = activeMsg.isGroup;
    const rawKey = activeMsg.rawMessage?.key as any;
    const lidJid = (rawKey?.participant?.includes('@lid') ? rawKey.participant : null) ||
                   (rawKey?.remoteJid?.includes('@lid') ? rawKey.remoteJid : null);

    let text = `ðŸ†” *WHATSAPP IDENTIFIER METADATA*\n\n` +
      `â€¢ *Phone Number:* +${activeMsg.senderNumber}\n` +
      `â€¢ *Sender JID:* \`${activeMsg.senderJid}\`\n` +
      `â€¢ *Chat JID:* \`${activeMsg.chatId}\`\n` +
      `â€¢ *Chat Type:* ${isGroup ? 'Group Chat ðŸ‘¥' : 'Direct Message ðŸ‘¤'}`;

    if (lidJid) {
      text += `\nâ€¢ *WhatsApp LID:* \`${lidJid}\` (Privacy Identifier)`;
    }

    await client.sendMessage(activeMsg.chatId, text);
  },
};
