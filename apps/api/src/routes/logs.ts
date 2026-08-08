import { FastifyInstance } from 'fastify';
import { db } from '@private-md-bot/database';

export function registerLogRoutes(fastify: FastifyInstance) {
  fastify.get('/api/logs', { onRequest: [fastify.authenticate] }, async (request) => {
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
