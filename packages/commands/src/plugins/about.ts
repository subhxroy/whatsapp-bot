import { CommandPlugin } from '../types';

export const aboutCommand: CommandPlugin = {
  name: 'about',
  aliases: ['info', 'version'],
  description: 'Display bot architecture and runtime details',
  category: 'general',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const text = `🔒 *Private Self-Hosted WhatsApp Bot*
• *Architecture:* Monorepo (Node.js 22 + TypeScript + Baileys)
• *Security:* AES-256-GCM Session Encryption at Rest
• *Telemetry:* None (Zero analytics, zero tracking)
• *Logging:* Privately scoped operational logs
• *Dashboard:* Next.js + Fastify + Redis + Firestore`;

    await ctx.reply(text);
  },
};
