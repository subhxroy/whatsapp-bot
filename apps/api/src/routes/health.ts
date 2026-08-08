import { FastifyInstance } from 'fastify';
import { db } from '@private-md-bot/database';
import { SessionManager } from '../session-manager';

export function registerHealthRoutes(fastify: FastifyInstance, sessionManager: SessionManager) {
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/api/ready', async (request, reply) => {
    let dbStatus = 'down';
    const connectedSessions = sessionManager.getConnectedCount();

    try {
      await db.ping();
      dbStatus = 'up';
    } catch {}

    const isReady = dbStatus === 'up';

    if (!isReady) {
      reply.status(503);
    }

    return {
      ready: isReady,
      services: {
        database: dbStatus,
        activeSessions: connectedSessions,
      },
      timestamp: new Date().toISOString(),
    };
  });
}
