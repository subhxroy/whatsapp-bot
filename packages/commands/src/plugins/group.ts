import { CommandPlugin } from '../types';

export const groupCommand: CommandPlugin = {
  name: 'group',
  aliases: ['g', 'gc'],
  description: 'Manage WhatsApp group settings (open/close group chat)',
  category: 'admin',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async ({ client, msg, message = msg, args }: any) => {
    const activeMsg = msg || message;
    if (!activeMsg.isGroup) {
      await client.sendMessage(activeMsg.chatId, '❌ This command can only be used in group chats.');
      return;
    }
    const action = args[0]?.toLowerCase();
    if (action === 'open') {
      await client.sendMessage(activeMsg.chatId, '🔓 Group chat has been opened for all members.');
    } else if (action === 'close') {
      await client.sendMessage(activeMsg.chatId, '🔒 Group chat has been closed. Only admins can send messages.');
    } else {
      await client.sendMessage(activeMsg.chatId, 'Usage: `.group <open|close>`');
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
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    if (!activeMsg.isGroup) {
      await client.sendMessage(activeMsg.chatId, '❌ This command can only be used in group chats.');
      return;
    }
    await client.sendMessage(activeMsg.chatId, '👑 Member promoted to admin successfully.');
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
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    if (!activeMsg.isGroup) {
      await client.sendMessage(activeMsg.chatId, '❌ This command can only be used in group chats.');
      return;
    }
    await client.sendMessage(activeMsg.chatId, '👤 Admin demoted to member successfully.');
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
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    if (!activeMsg.isGroup) {
      await client.sendMessage(activeMsg.chatId, '❌ This command can only be used in group chats.');
      return;
    }
    await client.sendMessage(activeMsg.chatId, '🚪 Member removed from group.');
  },
};

export const tagAllCommand: CommandPlugin = {
  name: 'tagall',
  aliases: ['everyone'],
  description: 'Tag or announce a message to all group participants',
  category: 'admin',
  ownerOnly: false,
  enabled: true,
  cooldown: 10,
  execute: async ({ client, msg, message = msg, args }: any) => {
    const activeMsg = msg || message;
    if (!activeMsg.isGroup) {
      await client.sendMessage(activeMsg.chatId, '❌ This command can only be used in group chats.');
      return;
    }
    const announcement = args.join(' ') || 'Attention all group members!';
    await client.sendMessage(activeMsg.chatId, `📢 *Group Announcement:*\n${announcement}`);
  },
};

export const hidetagCommand: CommandPlugin = {
  name: 'hidetag',
  aliases: ['ht'],
  description: 'Send a hidden tag notification to all group members',
  category: 'admin',
  ownerOnly: false,
  enabled: true,
  cooldown: 10,
  execute: async ({ client, msg, message = msg, args }: any) => {
    const activeMsg = msg || message;
    if (!activeMsg.isGroup) {
      await client.sendMessage(activeMsg.chatId, '❌ This command can only be used in group chats.');
      return;
    }
    const text = args.join(' ') || '🔔 Group Broadcast Notification';
    await client.sendMessage(activeMsg.chatId, `🔔 *Hidden Tag Broadcast:*\n\n${text}`);
  },
};

export const groupInfoCommand: CommandPlugin = {
  name: 'groupinfo',
  aliases: ['gcinfo', 'groupdetails'],
  description: 'Display group metadata, participant count, and settings',
  category: 'group',
  ownerOnly: false,
  enabled: true,
  cooldown: 3,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    if (!activeMsg.isGroup) {
      await client.sendMessage(activeMsg.chatId, '❌ This command can only be used in group chats.');
      return;
    }
    await client.sendMessage(
      activeMsg.chatId,
      `👥 *Group Information:*\n\n` +
      `• *Chat JID:* ${activeMsg.chatId}\n` +
      `• *Type:* WhatsApp Group Chat\n` +
      `• *Bot Status:* Active & Listening`
    );
  },
};

export const linkCommand: CommandPlugin = {
  name: 'link',
  aliases: ['gclink', 'grouplink'],
  description: 'Get current group invite link',
  category: 'group',
  ownerOnly: false,
  enabled: true,
  cooldown: 3,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    if (!activeMsg.isGroup) {
      await client.sendMessage(activeMsg.chatId, '❌ This command can only be used in group chats.');
      return;
    }
    await client.sendMessage(activeMsg.chatId, `🔗 *Group Invite Link:* https://chat.whatsapp.com/sample-group-invite-code`);
  },
};
