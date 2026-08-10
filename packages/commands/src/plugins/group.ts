import { CommandPlugin } from '../types';

// Helper: get first mentioned JID from context info
function getMentionedJid(ctx: any): string | null {
  const contextInfo = ctx.message.rawMessage?.message?.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid;
  if (mentions && mentions.length > 0) return mentions[0];
  // Also check participant of quoted message
  const quotedParticipant = contextInfo?.participant;
  return quotedParticipant || null;
}

export const groupCommand: CommandPlugin = {
  name: 'group',
  aliases: ['g', 'gc'],
  description: 'Manage WhatsApp group settings (open/close group chat)',
  category: 'admin',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const { client, msg } = ctx;
    const activeMsg = msg!;
    if (!activeMsg.isGroup) {
      return await ctx.reply('\u274c This command can only be used in group chats.');
    }
    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('\u26d4 Only group admins or bot owner can change group settings.');
    }
    const action = ctx.args[0]?.toLowerCase();
    if (action === 'open') {
      try {
        const socket = (client as any).socket;
        if (socket) await socket.groupSettingUpdate(activeMsg.chatId, 'not_announcement');
        await ctx.reply('\u{1F513} Group chat has been *opened* for all members.');
      } catch (err: any) {
        await ctx.reply(`\u274c Failed to open group: ${err.message}`);
      }
    } else if (action === 'close') {
      try {
        const socket = (client as any).socket;
        if (socket) await socket.groupSettingUpdate(activeMsg.chatId, 'announcement');
        await ctx.reply('\u{1F512} Group chat has been *closed*. Only admins can send messages.');
      } catch (err: any) {
        await ctx.reply(`\u274c Failed to close group: ${err.message}`);
      }
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
  ownerOnly: true,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const activeMsg = ctx.msg!;
    if (!activeMsg.isGroup) {
      return await ctx.reply('\u274c This command can only be used in group chats.');
    }
    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('\u26d4 Only group admins or bot owner can promote members.');
    }
    const targetJid = getMentionedJid(ctx);
    if (!targetJid) {
      return await ctx.reply('\u26a0\ufe0f Please mention or quote the user you want to promote.');
    }
    try {
      const socket = (ctx.client as any).socket;
      if (socket) await socket.groupParticipantsUpdate(activeMsg.chatId, [targetJid], 'promote');
      const num = targetJid.split('@')[0];
      await ctx.reply(`\u{1F451} @${num} has been promoted to group admin!`);
    } catch (err: any) {
      await ctx.reply(`\u274c Failed to promote: ${err.message}`);
    }
  },
};

export const demoteCommand: CommandPlugin = {
  name: 'demote',
  aliases: ['dm'],
  description: 'Demote a mentioned admin back to member',
  category: 'admin',
  ownerOnly: true,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const activeMsg = ctx.msg!;
    if (!activeMsg.isGroup) {
      return await ctx.reply('\u274c This command can only be used in group chats.');
    }
    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('\u26d4 Only group admins or bot owner can demote members.');
    }
    const targetJid = getMentionedJid(ctx);
    if (!targetJid) {
      return await ctx.reply('\u26a0\ufe0f Please mention or quote the user you want to demote.');
    }
    try {
      const socket = (ctx.client as any).socket;
      if (socket) await socket.groupParticipantsUpdate(activeMsg.chatId, [targetJid], 'demote');
      const num = targetJid.split('@')[0];
      await ctx.reply(`\u{1F464} @${num} has been demoted to member.`);
    } catch (err: any) {
      await ctx.reply(`\u274c Failed to demote: ${err.message}`);
    }
  },
};

export const kickCommand: CommandPlugin = {
  name: 'kick',
  aliases: ['remove'],
  description: 'Remove a mentioned user from the group',
  category: 'admin',
  ownerOnly: true,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const activeMsg = ctx.msg!;
    if (!activeMsg.isGroup) {
      return await ctx.reply('\u274c This command can only be used in group chats.');
    }
    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('\u26d4 Only group admins or bot owner can remove members.');
    }
    const targetJid = getMentionedJid(ctx);
    if (!targetJid) {
      return await ctx.reply('\u26a0\ufe0f Please mention or quote the user you want to remove.');
    }
    try {
      const socket = (ctx.client as any).socket;
      if (socket) await socket.groupParticipantsUpdate(activeMsg.chatId, [targetJid], 'remove');
      const num = targetJid.split('@')[0];
      await ctx.reply(`\u{1F6AA} @${num} has been removed from the group.`);
    } catch (err: any) {
      await ctx.reply(`\u274c Failed to remove member: ${err.message}`);
    }
  },
};

export const tagAllCommand: CommandPlugin = {
  name: 'tagall',
  aliases: ['everyone'],
  description: 'Tag or announce a message to all group participants',
  category: 'admin',
  ownerOnly: true,
  enabled: true,
  cooldown: 10,
  execute: async (ctx) => {
    const activeMsg = ctx.msg!;
    if (!activeMsg.isGroup) {
      return await ctx.reply('\u274c This command can only be used in group chats.');
    }
    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('\u26d4 Only group admins or bot owner can tag all members.');
    }
    const announcement = ctx.args.join(' ') || 'Attention all group members!';
    try {
      const socket = (ctx.client as any).socket;
      let mentions: string[] = [];
      if (socket && typeof socket.groupMetadata === 'function') {
        const meta = await socket.groupMetadata(activeMsg.chatId);
        mentions = (meta?.participants || []).map((p: any) => p.id).filter(Boolean);
      }
      const mentionText = mentions.map((jid) => `@${jid.split('@')[0]}`).join(' ');
      await socket.sendMessage(activeMsg.chatId, {
        text: `\u{1F4E2} *Group Announcement:*\n${announcement}\n\n${mentionText}`,
        mentions,
      });
    } catch {
      await ctx.reply(`\u{1F4E2} *Group Announcement:*\n${announcement}`);
    }
  },
};

export const hidetagCommand: CommandPlugin = {
  name: 'hidetag',
  aliases: ['ht'],
  description: 'Send a hidden tag notification to all group members',
  category: 'admin',
  ownerOnly: true,
  enabled: true,
  cooldown: 10,
  execute: async (ctx) => {
    const activeMsg = ctx.msg!;
    if (!activeMsg.isGroup) {
      return await ctx.reply('\u274c This command can only be used in group chats.');
    }
    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('\u26d4 Only group admins or bot owner can broadcast hidden tags.');
    }
    const text = ctx.args.join(' ') || '\u{1F514} Group Broadcast Notification';
    try {
      const socket = (ctx.client as any).socket;
      let mentions: string[] = [];
      if (socket && typeof socket.groupMetadata === 'function') {
        const meta = await socket.groupMetadata(activeMsg.chatId);
        mentions = (meta?.participants || []).map((p: any) => p.id).filter(Boolean);
      }
      await socket.sendMessage(activeMsg.chatId, { text, mentions });
    } catch {
      await ctx.reply(text);
    }
  },
};

export const groupInfoCommand: CommandPlugin = {
  name: 'groupinfo',
  aliases: ['gcinfo', 'groupdetails'],
  description: 'Display group metadata, participant count, and settings',
  category: 'group',
  ownerOnly: true,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const activeMsg = ctx.msg!;
    if (!activeMsg.isGroup) {
      return await ctx.reply('\u274c This command can only be used in group chats.');
    }
    try {
      const socket = (ctx.client as any).socket;
      if (socket && typeof socket.groupMetadata === 'function') {
        const meta = await socket.groupMetadata(activeMsg.chatId);
        const admins = (meta?.participants || []).filter((p: any) => p.admin).length;
        const created = meta?.creation ? new Date(meta.creation * 1000).toLocaleDateString() : 'Unknown';
        await ctx.reply(
          `\u{1F465} *Group Information*\n\n` +
          `\u2022 *Name:* ${meta?.subject || 'Unknown'}\n` +
          `\u2022 *Chat JID:* ${activeMsg.chatId}\n` +
          `\u2022 *Members:* ${meta?.participants?.length || 0}\n` +
          `\u2022 *Admins:* ${admins}\n` +
          `\u2022 *Created:* ${created}\n` +
          `\u2022 *Bot Status:* Active & Listening`
        );
      } else {
        await ctx.reply(`\u{1F465} *Group Information:*\n\n\u2022 *Chat JID:* ${activeMsg.chatId}\n\u2022 *Type:* WhatsApp Group\n\u2022 *Bot Status:* Active`);
      }
    } catch (err: any) {
      await ctx.reply(`\u274c Failed to fetch group info: ${err.message}`);
    }
  },
};

export const linkCommand: CommandPlugin = {
  name: 'link',
  aliases: ['gclink', 'grouplink'],
  description: 'Get current group invite link',
  category: 'group',
  ownerOnly: true,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const activeMsg = ctx.msg!;
    if (!activeMsg.isGroup) {
      return await ctx.reply('\u274c This command can only be used in group chats.');
    }
    if (ctx.callerRole !== 'OWNER' && ctx.callerRole !== 'ADMIN') {
      return await ctx.reply('\u26d4 Only group admins or bot owner can fetch the group invite link.');
    }
    try {
      const socket = (ctx.client as any).socket;
      if (socket && typeof socket.groupInviteCode === 'function') {
        const code = await socket.groupInviteCode(activeMsg.chatId);
        await ctx.reply(`\u{1F517} *Group Invite Link:*\nhttps://chat.whatsapp.com/${code}`);
      } else {
        await ctx.reply('\u274c Could not retrieve invite link. Bot may not be a group admin.');
      }
    } catch (err: any) {
      await ctx.reply(`\u274c Failed to get invite link: ${err.message}`);
    }
  },
};
