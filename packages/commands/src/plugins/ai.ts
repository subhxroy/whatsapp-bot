import { CommandPlugin } from '../types';
import { getEnv } from '@private-md-bot/config';
import { generateText } from '@private-md-bot/ai';

export const aiCommand: CommandPlugin = {
  name: 'ai',
  aliases: ['ask', 'gemini', 'gpt'],
  description: 'Ask AI assistant a question (Opt-in required via server config)',
  category: 'ai',
  ownerOnly: true,
  cooldown: 5,
  enabled: true,
  execute: async (ctx) => {
    const env = getEnv();
    if (!env.AI_ENABLED) {
      return await ctx.reply(
        '\u{26A0}\uFE0F AI assistant is disabled in server configuration. No data was sent to any provider.'
      );
    }

    const prompt = ctx.args.join(' ').trim();
    if (!prompt) {
      return await ctx.reply(
        `\u{26A0}\uFE0F Usage: \`${ctx.prefix}ai <your question>\`\nExample: \`${ctx.prefix}ai Explain quantum computing in 2 sentences\``
      );
    }

    await ctx.reply('\u{1F916} Thinking...');

    try {
      const response = await generateText(prompt);
      await ctx.reply(`\u{1F916} *AI (${response.model}):*\n${response.text}`);
    } catch (err: any) {
      await ctx.reply(`\u{26A0}\uFE0F AI Request failed: ${err.message || 'Unknown error'}`);
    }
  },
};
