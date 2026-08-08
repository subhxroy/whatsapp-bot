import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@private-md-bot/database';
import { getEnv } from '@private-md-bot/config';
import { logAudit } from '../queue';

const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export function registerSettingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/settings', { onRequest: [fastify.authenticate] }, async () => {
    const env = getEnv();
    const dbSettings = await db.getSettings();

    return {
      environment: {
        messageLogging: env.MESSAGE_LOGGING,
        aiEnabled: env.AI_ENABLED,
        mediaRetention: env.MEDIA_RETENTION,
        analytics: env.ANALYTICS,
        ownerNumber: env.BOT_OWNER_NUMBER,
      },
      settings: dbSettings,
    };
  });

  fastify.put('/api/settings', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const { key, value } = updateSettingSchema.parse(request.body);

    const setting = await db.upsertSetting({ key, value, description: 'Updated via dashboard' });

    await logAudit('SETTING_UPDATE', user.username, `Updated setting ${key} = ${value}`, request.ip);

    return { setting };
  });
}
