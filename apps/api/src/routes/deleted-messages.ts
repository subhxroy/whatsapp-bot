import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@private-md-bot/database';
import { isAdminUser } from '@private-md-bot/security';
import { logAudit } from '../queue';

const listQuerySchema = z.object({
  search: z.string().max(200).optional(),
  chatId: z.string().max(200).optional(),
  fromMe: z.enum(['true', 'false']).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

function toPage(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

export function registerDeletedMessageRoutes(fastify: FastifyInstance) {
  fastify.get('/api/deleted-messages', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.username || user?.id || '';
    const altUserId = user?.id || user?.username || '';
    const q = listQuerySchema.parse(request.query || {});

    const { messages, total } = await db.listDeletedMessages({
      userId,
      altUserId,
      isOwnerOrAdmin: isAdmin,
      search: q.search,
      chatId: q.chatId,
      fromMe: q.fromMe === undefined ? undefined : q.fromMe === 'true',
      page: toPage(q.page, 1),
      pageSize: toPage(q.pageSize, 25),
    } as any);
    return { messages, total, page: toPage(q.page, 1), pageSize: toPage(q.pageSize, 25) };
  });

  fastify.delete('/api/deleted-messages/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const success = await db.deleteDeletedMessage(id, userId, isAdmin);
    if (!success) {
      return reply.status(404).send({ error: 'Deleted message not found' });
    }

    await logAudit('DELETED_MESSAGE_PURGE', user.username || userId, `Purged deleted-message record ${id}`, request.ip);
    return { success: true };
  });
}
