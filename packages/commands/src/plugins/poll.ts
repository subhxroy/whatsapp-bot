import { CommandPlugin } from '../types';

export const pollCommand: CommandPlugin = {
  name: 'poll',
  aliases: ['createpoll'],
  description: 'Create an interactive WhatsApp poll in group or DM',
  category: 'utility',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const rawArgs = ctx.args.join(' ').trim();
    if (!rawArgs || !rawArgs.includes('|')) {
      return await ctx.reply(
        `📊 *WHATSAPP POLL CREATOR*\n\n` +
          `*Usage Syntax:*\n` +
          `\`${ctx.prefix}poll <question> | <option1> | <option2> | ...\`\n\n` +
          `*Example:*\n` +
          `\`${ctx.prefix}poll What should we eat for dinner? | Pizza | Burger | Sushi\``
      );
    }

    const parts = rawArgs.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) {
      return await ctx.reply('❌ Poll requires a question and at least 2 options separated by `|`.');
    }

    const question = parts[0];
    const options = parts.slice(1);

    await ctx.replyWithPoll(question, options);
  },
};
