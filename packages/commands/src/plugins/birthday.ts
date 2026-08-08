import { CommandPlugin } from '../types';
import { db } from '@private-md-bot/database';

export const birthdayCommand: CommandPlugin = {
  name: 'birthday',
  aliases: ['wish', 'schedule', 'schedulemsg'],
  description: 'Schedule a birthday wish or automated message to a target phone number',
  category: 'utility',
  ownerOnly: false,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const rawArgs = ctx.args.join(' ').trim();
    if (!rawArgs || !rawArgs.includes('|')) {
      return await ctx.reply(
        `🎂 *BIRTHDAY & SCHEDULED MESSAGE TOOL*\n\n` +
          `*Usage Syntax:*\n` +
          `\`${ctx.prefix}birthday <phone_number> <YYYY-MM-DD HH:mm> | <message>\`\n\n` +
          `*Examples:*\n` +
          `• \`${ctx.prefix}birthday 919876543210 2026-08-09 00:00 | Happy Birthday my friend! 🎉🎂\`\n` +
          `• \`${ctx.prefix}schedule 919876543210 2026-08-09 09:30 | Morning meeting alert!\`\n\n` +
          `_Note: Type this in your self-chat or any chat. The target person WILL NOT see your command; the bot will send the wish directly at the exact scheduled time!_`
      );
    }

    const [header, ...msgParts] = rawArgs.split('|');
    const message = msgParts.join('|').trim();
    const headerTokens = header.trim().split(/\s+/);

    if (headerTokens.length < 3 || !message) {
      return await ctx.reply('❌ Invalid format. Please specify phone number, date, time, and message separated by `|`.');
    }

    const phoneInput = headerTokens[0];
    const dateStr = headerTokens[1]; // e.g. 2026-08-09
    const timeStr = headerTokens[2]; // e.g. 00:00

    const cleanNumber = phoneInput.replace(/\D/g, '');
    if (cleanNumber.length < 7) {
      return await ctx.reply('❌ Invalid target phone number.');
    }

    const targetJid = `${cleanNumber}@s.whatsapp.net`;
    const targetDateTime = new Date(`${dateStr}T${timeStr}:00`);

    if (isNaN(targetDateTime.getTime())) {
      return await ctx.reply('❌ Invalid Date/Time format. Please use `YYYY-MM-DD HH:mm` (e.g. `2026-08-09 00:00`).');
    }

    if (targetDateTime.getTime() <= Date.now()) {
      return await ctx.reply('❌ Scheduled time must be in the future.');
    }

    const record = await db.createScheduledMessage({
      targetNumber: cleanNumber,
      targetJid,
      message,
      scheduledAt: targetDateTime.toISOString(),
      senderJid: ctx.message.senderJid,
      type: ctx.message.body.toLowerCase().includes('birthday') ? 'BIRTHDAY' : 'SCHEDULED',
    });

    await ctx.reply(
      `✅ *SUCCESSFULLY SCHEDULED!*\n` +
        `• *Target Number:* +${cleanNumber}\n` +
        `• *Scheduled For:* ${targetDateTime.toLocaleString()}\n` +
        `• *Message:* ${message}\n` +
        `• *Reference ID:* \`${record.id}\`\n\n` +
        `_The message will automatically be sent by the bot at the exact time._`
    );
  },
};
