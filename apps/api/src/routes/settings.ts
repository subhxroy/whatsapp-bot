import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@private-md-bot/database';
import { getEnv } from '@private-md-bot/config';
import { logAudit } from '../queue';

const updateSingleSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

const updateBatchSettingSchema = z.object({
  settings: z.record(z.string(), z.string()),
});

const EXEMPT_EMAILS = ['contact.subhroy@gmail.com', 'aarxslan@gmail.com', 'admin', 'admin@openify.studio'];

function checkAdmin(user: any): boolean {
  if (!user) return false;
  const identifier = (user.email || user.username || user.id || '').toLowerCase();
  return EXEMPT_EMAILS.some((e) => e.toLowerCase() === identifier) || user.role === 'ADMIN' || user.role === 'OWNER';
}

function isValidOwnerNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function registerSettingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/settings', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const isAdmin = checkAdmin(user);
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
    if (!checkAdmin(user)) {
      return reply.status(403).send({ error: 'Access restricted to administrators' });
    }
    const body = request.body as any;

    if (body && typeof body.settings === 'object' && body.settings !== null) {
      const { settings } = updateBatchSettingSchema.parse(body);

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

    if (key === 'BOT_OWNER_NUMBER' && !isValidOwnerNumber(value)) {
      return reply.status(400).send({ error: 'Invalid BOT_OWNER_NUMBER: must contain a 7-15 digit phone number (country code + number).' });
    }

    const setting = await db.upsertSetting({ key, value, description: 'Updated via dashboard' });

    await logAudit('SETTING_UPDATE', user.username, `Updated setting ${key} = ${value}`, request.ip);
    if (key === 'BOT_OWNER_NUMBER') {
      await logAudit('OWNER_CONFIGURATION_CHANGED', user.username, 'Bot owner phone number updated via dashboard', request.ip);
    }

    return reply.send({ setting });
  });
}
