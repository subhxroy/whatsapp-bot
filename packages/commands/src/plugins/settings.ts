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
      text += `_Database Settings:_\n`;
      const SENSITIVE_PATTERNS = ['key', 'secret', 'token', 'password', 'uid', 'credential'];
      for (const s of dbSettings) {
        const keyLower = s.key.toLowerCase();
        const isSensitive = SENSITIVE_PATTERNS.some((p) => keyLower.includes(p));
        const displayValue = isSensitive ? '***' : s.value;
        text += `• \`${s.key}\`: ${displayValue}\n`;
      }
      return await ctx.reply(text);
    }

    const key = ctx.args[0];
    const value = ctx.args.slice(1).join(' ');

    if (!value) {
      return await ctx.reply(`Usage: \`${ctx.prefix}settings <key> <value>\``);
    }

    // 🔒 SECURITY: only settings keys actually consumed by the bot may be
    // written from WhatsApp. Arbitrary keys could inject unknown configuration
    // values that other components trust.
    if (!ALLOWED_SETTING_KEYS.has(key)) {
      return await ctx.reply(
        `❌ Setting \`${key}\` cannot be changed from WhatsApp. ` +
        `Allowed keys: ${[...ALLOWED_SETTING_KEYS].map((k) => `\`${k}\``).join(', ')}. ` +
        `Use the web dashboard for other settings.`
      );
    }

    if (key === 'BOT_OWNER_NUMBER' && !isValidOwnerNumber(value)) {
      return await ctx.reply('❌ Invalid BOT_OWNER_NUMBER: must be a 7-15 digit phone number (country code + number).');
    }

    await db.upsertSetting({ key, value, description: 'Updated via .settings command' });

    await ctx.reply(`✅ Updated setting \`${key}\`.`);
  },
};

// SECURITY: allowlist of settings keys that may be modified via the `.settings`
// WhatsApp command. Kept minimal to the keys the dispatcher and owner config
// actually consume.
const ALLOWED_SETTING_KEYS = new Set(['BOT_OWNER_NUMBER', 'prefix']);

function isValidOwnerNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}
