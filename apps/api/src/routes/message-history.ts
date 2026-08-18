import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@private-md-bot/database';
import { getEnv } from '@private-md-bot/config';
import { isAdminUser } from '@private-md-bot/security';

const listQuerySchema = z.object({
  chatId: z.string().max(200).optional(),
  senderNumber: z.string().max(30).optional(),
  limit: z.string().optional(),
  before: z.string().optional(),
});

function toLimit(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.min(200, Math.floor(n)) : fallback;
}

export function registerMessageHistoryRoutes(fastify: FastifyInstance) {
  fastify.get('/api/message-history', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const env = getEnv();
    const dbSetting = await db.getSetting('MESSAGE_HISTORY_ENABLED');
    const isHistoryEnabled = dbSetting ? dbSetting.value === 'true' : env.MESSAGE_HISTORY_ENABLED;

    if (!isHistoryEnabled) {
      return reply
        .status(403)
        .send({ error: 'Message history is disabled. Enable it in Dashboard > Settings to use this feature.' });
    }

    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.username || user?.id || '';
    const altUserId = user?.id || user?.username || '';
    const q = listQuerySchema.parse(request.query || {});

    const messages = await db.listMessageHistory({
      userId,
      altUserId,
      isOwnerOrAdmin: isAdmin,
      chatId: q.chatId,
      senderNumber: q.senderNumber,
      limit: toLimit(q.limit, 50),
      before: q.before,
    } as any);
    return { messages };
  });
}
