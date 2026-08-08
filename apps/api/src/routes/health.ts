import { FastifyInstance } from 'fastify';
import { db } from '@private-md-bot/database';
import { WhatsAppClient } from '@private-md-bot/whatsapp';

export function registerHealthRoutes(fastify: FastifyInstance, waClient: WhatsAppClient) {
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/api/ready', async (request, reply) => {
    let dbStatus = 'down';
    let waStatus = waClient.getStatus();

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
        whatsapp: waStatus,
      },
      timestamp: new Date().toISOString(),
    };
  });
}
