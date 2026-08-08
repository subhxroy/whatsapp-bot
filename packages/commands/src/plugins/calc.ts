import { CommandPlugin } from '../types';

export const calcCommand: CommandPlugin = {
  name: 'calc',
  aliases: ['math', 'calculate', '='],
  description: 'Safely evaluate mathematical expressions',
  category: 'utility',
  ownerOnly: false,
  enabled: true,
  cooldown: 2,
  execute: async (ctx) => {
    const expr = ctx.args.join('').trim();
    if (!expr) {
      return await ctx.reply(`🔢 *Usage:* \`${ctx.prefix}calc <expression>\` (e.g. \`${ctx.prefix}calc (100 * 5) / 2 + 15\`)`);
    }

    // Sanitize: allow only numbers, spaces, and math operators +, -, *, /, %, (, ), ^, .
    if (/[^0-9\+\-\*\/\%\(\)\^\.\s]/g.test(expr)) {
      return await ctx.reply('❌ Invalid expression. Only basic arithmetic operators (+, -, *, /, %, ^) and numbers are allowed.');
    }

    try {
      // Replace ^ with ** for exponentiation
      const sanitized = expr.replace(/\^/g, '**');
      const fn = new Function(`"use strict"; return (${sanitized});`);
      const result = fn();

      if (typeof result !== 'number' || !isFinite(result)) {
        return await ctx.reply('❌ Invalid math result (division by zero or overflow).');
      }

      await ctx.reply(`🔢 *MATH CALCULATION*\n• *Expression:* \`${expr}\`\n• *Result:* \`${result}\``);
    } catch {
      await ctx.reply('❌ Could not evaluate expression. Please check syntax.');
    }
  },
};
