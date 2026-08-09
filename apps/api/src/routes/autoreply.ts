import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, MatchType } from '@private-md-bot/database';
import { logAudit } from '../queue';

const EXEMPT_EMAILS = ['contact.subhroy@gmail.com', 'aarxslan@gmail.com', 'admin', 'admin@openify.studio'];

function checkAdmin(user: any): boolean {
  if (!user) return false;
  const identifier = (user.email || user.username || user.id || '').toLowerCase();
  return EXEMPT_EMAILS.some((e) => e.toLowerCase() === identifier) || user.role === 'ADMIN' || user.role === 'OWNER';
}

const autoReplySchema = z.object({
  trigger: z.string().optional().default('*'),
  matchType: z.enum(['EXACT', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX', 'ANY']),
  specificNumber: z.string().optional().nullable(),
  response: z.string().min(1),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(1),
  cooldown: z.number().int().default(5),
});

export function registerAutoReplyRoutes(fastify: FastifyInstance) {
  fastify.get('/api/auto-replies', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const isAdmin = checkAdmin(user);
    const userId = user?.id || user?.username || '';

    const rules = await db.getAutoReplies(userId, isAdmin);
    return { rules };
  });

  fastify.post('/api/auto-replies', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const userId = user?.id || user?.username || '';
    const body = autoReplySchema.parse(request.body);

    const triggerVal = body.matchType === 'ANY' ? (body.trigger?.trim() || '*') : (body.trigger?.trim() || '*');

    const rule = await db.createAutoReply({
      userId,
      trigger: triggerVal,
      matchType: body.matchType as MatchType,
      specificNumber: body.specificNumber?.trim() || null,
      response: body.response,
      enabled: body.enabled,
      priority: body.priority,
      cooldown: body.cooldown,
    });

    await logAudit('AUTO_REPLY_CREATE', user.username || userId, `Created auto-reply for trigger: ${rule.trigger}`, request.ip);

    return { rule };
  });

  fastify.put('/api/auto-replies/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = checkAdmin(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };
    const body = autoReplySchema.partial().parse(request.body);

    const rule = await db.updateAutoReply(
      id,
      {
        ...(body.trigger !== undefined && { trigger: body.trigger }),
        ...(body.matchType !== undefined && { matchType: body.matchType as MatchType }),
        ...(body.specificNumber !== undefined && { specificNumber: body.specificNumber }),
        ...(body.response !== undefined && { response: body.response }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.cooldown !== undefined && { cooldown: body.cooldown }),
      },
      userId,
      isAdmin
    );

    if (!rule) {
      reply.status(404);
      return { error: 'Auto-reply rule not found or unauthorized' };
    }

    await logAudit('AUTO_REPLY_UPDATE', user.username || userId, `Updated auto-reply rule ${id}`, request.ip);

    return { rule };
  });

  fastify.delete('/api/auto-replies/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = checkAdmin(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const success = await db.deleteAutoReply(id, userId, isAdmin);

    if (!success) {
      reply.status(403);
      return { error: 'Unauthorized or auto-reply rule not found' };
    }

    await logAudit('AUTO_REPLY_DELETE', user.username || userId, `Deleted auto-reply rule ${id}`, request.ip);

    return { success: true };
  });
}
