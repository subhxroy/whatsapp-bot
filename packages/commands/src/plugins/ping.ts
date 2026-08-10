import { CommandPlugin } from '../types';

export const pingCommand: CommandPlugin = {
  name: 'ping',
  aliases: ['p', 'pong'],
  description: 'Check bot response speed and uptime status',
  category: 'general',
  ownerOnly: true,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const startTime = Date.now();
    await ctx.reply('\u{1F3D3} Pinging...');
    const latency = Date.now() - startTime;
    const uptimeSec = process.uptime();
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = Math.floor(uptimeSec % 60);

    const text = `\u{1F916} *Pong!*\n\u{23F1}\uFE0F *Latency:* ${latency}ms\n\u{23F1}\uFE0F *Uptime:* ${hours}h ${minutes}m ${seconds}s`;

    await ctx.reply(text);
  },
};
