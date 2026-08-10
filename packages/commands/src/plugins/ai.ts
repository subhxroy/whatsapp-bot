import { CommandPlugin } from '../types';
import { getEnv } from '@private-md-bot/config';
import { getAIProvider } from '@private-md-bot/ai';

export const aiCommand: CommandPlugin = {
  name: 'ai',
  aliases: ['ask', 'gemini', 'gpt'],
  description: 'Ask the AI assistant a question (only if AI_ENABLED=true)',
  category: 'ai',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const env = getEnv();

    if (!env.AI_ENABLED) {
      return await ctx.reply('ðŸ”’ AI assistant is disabled in server configuration. No data was sent to any provider.');
    }

    const prompt = ctx.args.join(' ');
    if (!prompt) {
      return await ctx.reply(`Usage: \`${ctx.prefix}ai <your question or prompt>\``);
    }
    if (prompt.length > 2000) {
      return await ctx.reply('\u274c Prompt too long! Please keep it under 2000 characters.');
    }

    await ctx.reply('ðŸ¤– Thinking...');

    try {
      const provider = getAIProvider('gemini');
      const response = await provider.generateText(prompt, {
        systemPrompt: 'You are a helpful private WhatsApp bot assistant. Keep responses clear and concise.',
      });

      await ctx.reply(`ðŸ¤– *AI (${response.model}):*\n${response.text}`);
    } catch (err: any) {
      await ctx.reply(`âŒ AI Request failed: ${err.message || 'Unknown error'}`);
    }
  },
};
