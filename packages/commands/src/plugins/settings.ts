import { CommandPlugin } from '../types';
import { getEnv } from '@private-md-bot/config';
import { db } from '@private-md-bot/database';

export const settingsCommand: CommandPlugin = {
  name: 'settings',
  aliases: ['config', 'cfg'],
  description: 'View or update bot settings (Owner only)',
  category: 'admin',
  ownerOnly: true,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const env = getEnv();

    if (ctx.args.length === 0) {
      const dbSettings = await db.getSettings();
      let text = `⚙️ *Bot Configuration & Settings*\n\n`;
      text += `• *Default Prefix:* \`${ctx.prefix}\`\n`;
      text += `• *Message Logging:* ${env.MESSAGE_LOGGING ? 'Enabled' : 'Disabled'}\n`;
      text += `• *AI Assistant:* ${env.AI_ENABLED ? 'Enabled' : 'Disabled'}\n\n`;
      text += `_Database Settings overrides:_\n`;
      for (const s of dbSettings) {
        text += `• \`${s.key}\`: ${s.value}\n`;
      }
      return await ctx.reply(text);
    }

    const key = ctx.args[0];
    const value = ctx.args.slice(1).join(' ');

    if (!value) {
      return await ctx.reply(`Usage: \`${ctx.prefix}settings <key> <value>\``);
    }

    await db.upsertSetting({ key, value, description: 'Updated via .settings command' });

    await ctx.reply(`✅ Updated setting \`${key}\` to \`${value}\`.`);
  },
};
