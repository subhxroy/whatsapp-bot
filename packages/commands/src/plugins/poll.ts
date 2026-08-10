import { CommandPlugin } from '../types';

export const pollCommand: CommandPlugin = {
  name: 'poll',
  aliases: ['createpoll'],
  description: 'Create an interactive WhatsApp poll in group or DM',
  category: 'utility',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const rawArgs = ctx.args.join(' ').trim();
    if (!rawArgs || !rawArgs.includes('|')) {
      return await ctx.reply(
        `\u{1F4CA} *WHATSAPP POLL CREATOR*\n\n` +
          `*Usage Syntax:*\n` +
          `\`${ctx.prefix}poll <question> | <option1> | <option2> | ...\`\n\n` +
          `*Example:*\n` +
          `\`${ctx.prefix}poll What should we eat for dinner? | Pizza | Burger | Sushi\``
      );
    }

    const parts = rawArgs.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) {
      return await ctx.reply('\u274c Poll requires a question and at least 2 options separated by `|`.');
    }

    const question = parts[0];
    if (question.length > 100) {
      return await ctx.reply('\u274c Poll question too long (max 100 characters).');
    }
    const options = parts.slice(1, 13).map((opt) => {
      if (opt.length > 50) {
        return `\u274c Poll option too long (max 50 characters): ${opt.slice(0, 50)}...`;
      }
      return opt;
    });
    if (options.some((o) => o.startsWith('\u274c'))) {
      return await ctx.reply('\u274c Poll options must be 50 characters or fewer.');
    }

    try {
      // Use the actual Baileys sendMessage poll API via socket on client
      const socket = (ctx.client as any).socket;
      if (socket && typeof socket.sendMessage === 'function') {
        await socket.sendMessage(ctx.message.chatId, {
          poll: {
            name: question,
            values: options,
            selectableCount: 1,
          },
        });
      } else {
        // Fallback: format poll as readable text if socket not accessible
        let pollText = `\u{1F4CA} *POLL: ${question}*\n\n`;
        options.forEach((opt, i) => {
          pollText += `${['1\ufe0f\u20e3','2\ufe0f\u20e3','3\ufe0f\u20e3','4\ufe0f\u20e3','5\ufe0f\u20e3','6\ufe0f\u20e3','7\ufe0f\u20e3','8\ufe0f\u20e3','9\ufe0f\u20e3','0\ufe0f\u20e3'][i] || `${i+1}.`} ${opt}\n`;
        });
        pollText += `\n_Reply with the number of your choice!_`;
        await ctx.reply(pollText);
      }
    } catch (err: any) {
      await ctx.reply(`\u274c Failed to create poll: ${err.message || 'Unknown error'}`);
    }
  },
};
