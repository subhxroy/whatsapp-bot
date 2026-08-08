import { CommandPlugin } from '../types';
import { getEnv } from '@private-md-bot/config';
import { getAIProvider } from '@private-md-bot/ai';

export const aiCommand: CommandPlugin = {
  name: 'ai',
  aliases: ['ask', 'gemini', 'gpt'],
  description: 'Ask the AI assistant a question (only if AI_ENABLED=true)',
  category: 'ai',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const env = getEnv();

    if (!env.AI_ENABLED) {
      return await ctx.reply('🔒 AI assistant is disabled in server configuration. No data was sent to any provider.');
    }

    const prompt = ctx.args.join(' ');
    if (!prompt) {
      return await ctx.reply(`Usage: \`${ctx.prefix}ai <your question or prompt>\``);
    }

    await ctx.reply('🤖 Thinking...');

    try {
      const provider = getAIProvider('gemini');
      const response = await provider.generateText(prompt, {
        systemPrompt: 'You are a helpful private WhatsApp bot assistant. Keep responses clear and concise.',
      });

      await ctx.reply(`🤖 *AI (${response.model}):*\n${response.text}`);
    } catch (err: any) {
      await ctx.reply(`❌ AI Request failed: ${err.message || 'Unknown error'}`);
    }
  },
};
