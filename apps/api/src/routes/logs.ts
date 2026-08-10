import { FastifyInstance } from 'fastify';
import { db } from '@private-md-bot/database';
import { isAdminUser } from '@private-md-bot/security';

export function registerLogRoutes(fastify: FastifyInstance) {
  fastify.get('/api/logs', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user || {};
    if (!isAdminUser(user)) {
      return reply.status(403).send({ error: 'Access restricted to administrators' });
    }
    const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };

    const take = Math.min(parseInt(limit, 10) || 50, 100);
    const skip = parseInt(offset, 10) || 0;

    const [logs, total] = await Promise.all([
      db.getAuditLogs({ take, skip }),
      db.countAuditLogs(),
    ]);

    return { logs, total, limit: take, offset: skip };
  });
}
