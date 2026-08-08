import { CommandPlugin } from '../types';

export const aboutCommand: CommandPlugin = {
  name: 'about',
  aliases: ['info', 'version'],
  description: 'Display bot architecture, version and creator details',
  category: 'general',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const text = `🔥 *CALDERA BOT — CONTROL CENTER*
• *Developer:* Subhankar Roy
• *Version:* 2.4.0 (Monorepo Production)
• *Engine:* Node.js 22 + TypeScript + Baileys v6
• *Database:* Firebase Firestore (AES-256-GCM Session Encryption)
• *Dashboard:* Next.js 15 + Fastify API
• *GitHub Repo:* https://github.com/subhxroy/whatsapp-bot

_Zero telemetry. 100% private & self-hosted._`;

    await ctx.reply(text);
  },
};
