import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@private-md-bot/database';
import { getEnv } from '@private-md-bot/config';
import { isAdminUser } from '@private-md-bot/security';
import { logAudit } from '../queue';

const updateSingleSettingSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.string().max(2000),
});

const updateBatchSettingSchema = z.object({
  settings: z.record(z.string().min(1).max(64), z.string().max(2000)),
});

// SECURITY: only settings keys actually consumed by the bot may be written from
// the dashboard. Arbitrary keys could inject configuration values that other
// components trust (e.g. a key named to collide with an env var or audit path).
const ALLOWED_SETTING_KEYS = new Set([
  'BOT_OWNER_NUMBER',
  'prefix',
  'COMMAND_PREFIX',
  'MESSAGE_LOGGING',
  'AI_ENABLED',
  'AI_PROVIDER',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OLLAMA_BASE_URL',
  'MESSAGE_HISTORY_ENABLED',
  'MESSAGE_CONTENT_RETENTION',
  'DELETED_MESSAGE_RETENTION',
]);

const RETENTION_KEYS = new Map<string, string[]>([
  ['MESSAGE_CONTENT_RETENTION', ['metadata', '7d', '30d', '90d']],
  ['DELETED_MESSAGE_RETENTION', ['24h', '7d', '30d', '90d', 'forever']],
]);

function rejectDisallowedKeys(keys: string[]): string[] {
  return keys.filter((k) => !ALLOWED_SETTING_KEYS.has(k));
}

function isValidOwnerNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function validateRetentionKeys(settings: Record<string, string>): string[] {
  const invalid: string[] = [];
  for (const [key, allowed] of RETENTION_KEYS) {
    if (settings[key] !== undefined && !allowed.includes(settings[key])) {
      invalid.push(`${key}=${settings[key]} (allowed: ${allowed.join(', ')})`);
    }
  }
  return invalid;
}

export function registerSettingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/settings', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const env = getEnv();
    const dbSettings = await db.getSettings();

    const settingsMap: Record<string, string> = {
      AI_ENABLED: String(env.AI_ENABLED),
      AI_PROVIDER: 'gemini',
      // 🔒 SECURITY: API keys are only exposed to admins, masked for regular users
      GEMINI_API_KEY: isAdmin ? (env.GEMINI_API_KEY || '') : (env.GEMINI_API_KEY ? '***' : ''),
      OPENAI_API_KEY: isAdmin ? (env.OPENAI_API_KEY || '') : (env.OPENAI_API_KEY ? '***' : ''),
      OPENAI_BASE_URL: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      OLLAMA_BASE_URL: env.OLLAMA_BASE_URL || 'http://localhost:11434',
      MESSAGE_LOGGING: String(env.MESSAGE_LOGGING),
      MESSAGE_HISTORY_ENABLED: String(env.MESSAGE_HISTORY_ENABLED),
      MESSAGE_CONTENT_RETENTION: env.MESSAGE_CONTENT_RETENTION,
      DELETED_MESSAGE_RETENTION: env.DELETED_MESSAGE_RETENTION,
      COMMAND_PREFIX: '.',
      BOT_OWNER_NUMBER: isAdmin ? (env.BOT_OWNER_NUMBER || '') : '***',
    };

    for (const item of dbSettings) {
      settingsMap[item.key] = item.value;
    }

    return {
      environment: {
        messageLogging: settingsMap.MESSAGE_LOGGING === 'true',
        aiEnabled: settingsMap.AI_ENABLED === 'true',
        messageHistoryEnabled: settingsMap.MESSAGE_HISTORY_ENABLED === 'true',
        messageContentRetention: settingsMap.MESSAGE_CONTENT_RETENTION,
        deletedMessageRetention: settingsMap.DELETED_MESSAGE_RETENTION,
        mediaRetention: env.MEDIA_RETENTION,
        analytics: env.ANALYTICS,
        ownerNumber: isAdmin ? settingsMap.BOT_OWNER_NUMBER : '***',
      },
      settingsMap,
      settings: dbSettings,
    };
  });

  fastify.put('/api/settings', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    if (!isAdminUser(user)) {
      return reply.status(403).send({ error: 'Access restricted to administrators' });
    }
    const body = request.body as any;

    if (body && typeof body.settings === 'object' && body.settings !== null) {
      const { settings } = updateBatchSettingSchema.parse(body);

      const disallowed = rejectDisallowedKeys(Object.keys(settings));
      if (disallowed.length > 0) {
        return reply.status(400).send({ error: `Setting keys not allowed: ${disallowed.join(', ')}` });
      }

      const invalidRetention = validateRetentionKeys(settings);
      if (invalidRetention.length > 0) {
        return reply.status(400).send({ error: `Invalid retention values: ${invalidRetention.join('; ')}` });
      }

      // Validate security-critical owner number before persisting
      if (settings.BOT_OWNER_NUMBER !== undefined && !isValidOwnerNumber(settings.BOT_OWNER_NUMBER)) {
        return reply.status(400).send({ error: 'Invalid BOT_OWNER_NUMBER: must contain a 7-15 digit phone number (country code + number).' });
      }

      const updatedList = [];
      for (const [k, v] of Object.entries(settings)) {
        const item = await db.upsertSetting({ key: k, value: String(v), description: 'Updated via web dashboard' });
        updatedList.push(item);
      }
      await logAudit('SETTINGS_BATCH_UPDATE', user.username, `Batch updated ${updatedList.length} settings via dashboard`, request.ip);
      if (settings.BOT_OWNER_NUMBER !== undefined) {
        await logAudit('OWNER_CONFIGURATION_CHANGED', user.username, 'Bot owner phone number updated via dashboard', request.ip);
      }
      return reply.send({ success: true, count: updatedList.length });
    }

    const { key, value } = updateSingleSettingSchema.parse(body);

    if (!ALLOWED_SETTING_KEYS.has(key)) {
      return reply.status(400).send({ error: `Setting key not allowed: ${key}` });
    }

    const retentionAllowed = RETENTION_KEYS.get(key);
    if (retentionAllowed && !retentionAllowed.includes(value)) {
      return reply.status(400).send({ error: `Invalid value for ${key}: allowed ${retentionAllowed.join(', ')}` });
    }

    if (key === 'BOT_OWNER_NUMBER' && !isValidOwnerNumber(value)) {
      return reply.status(400).send({ error: 'Invalid BOT_OWNER_NUMBER: must contain a 7-15 digit phone number (country code + number).' });
    }

    const setting = await db.upsertSetting({ key, value, description: 'Updated via dashboard' });

    // SECURITY: never persist secret key values (API keys) into the audit log.
    const auditValue = key.includes('API_KEY') ? '***' : value;
    await logAudit('SETTING_UPDATE', user.username, `Updated setting ${key} = ${auditValue}`, request.ip);
    if (key === 'BOT_OWNER_NUMBER') {
      await logAudit('OWNER_CONFIGURATION_CHANGED', user.username, 'Bot owner phone number updated via dashboard', request.ip);
    }

    return reply.send({ setting });
  });
}
