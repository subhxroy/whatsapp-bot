import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, MatchType } from '@private-md-bot/database';
import { logAudit } from '../queue';

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
  fastify.get('/api/auto-replies', { onRequest: [fastify.authenticate] }, async () => {
    const rules = await db.getAutoReplies();
    return { rules };
  });

  fastify.post('/api/auto-replies', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const body = autoReplySchema.parse(request.body);

    const triggerVal = body.matchType === 'ANY' ? (body.trigger?.trim() || '*') : (body.trigger?.trim() || '*');

    const rule = await db.createAutoReply({
      trigger: triggerVal,
      matchType: body.matchType as MatchType,
      specificNumber: body.specificNumber?.trim() || null,
      response: body.response,
      enabled: body.enabled,
      priority: body.priority,
      cooldown: body.cooldown,
    });

    await logAudit('AUTO_REPLY_CREATE', user.username, `Created auto-reply for trigger: ${rule.trigger}`, request.ip);

    return { rule };
  });

  fastify.put('/api/auto-replies/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const body = autoReplySchema.partial().parse(request.body);

    const rule = await db.updateAutoReply(id, {
      ...(body.trigger !== undefined && { trigger: body.trigger }),
      ...(body.matchType !== undefined && { matchType: body.matchType as MatchType }),
      ...(body.specificNumber !== undefined && { specificNumber: body.specificNumber }),
      ...(body.response !== undefined && { response: body.response }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.cooldown !== undefined && { cooldown: body.cooldown }),
    });

    if (!rule) {
      reply.status(404);
      return { error: 'Auto-reply rule not found' };
    }

    await logAudit('AUTO_REPLY_UPDATE', user.username, `Updated auto-reply rule ${id}`, request.ip);

    return { rule };
  });

  fastify.delete('/api/auto-replies/:id', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    await db.deleteAutoReply(id);

    await logAudit('AUTO_REPLY_DELETE', user.username, `Deleted auto-reply rule ${id}`, request.ip);

    return { success: true };
  });
}
