import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SessionManager } from '../session-manager';
import { logAudit } from '../queue';

const pairCodeSchema = z.object({
  phoneNumber: z.string().min(8),
});

export function registerWhatsAppRoutes(fastify: FastifyInstance, sessionManager: SessionManager) {
  fastify.get('/api/whatsapp/status', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const userId = user?.id || user?.username || '';

    const { status, qrCode } = sessionManager.getStatus(userId);
    return { status, qrCode };
  });

  fastify.post('/api/whatsapp/connect', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const userId = user?.id || user?.username || '';

    await sessionManager.connect(userId);
    await logAudit('WHATSAPP_CONNECT', user.username, 'Initiated WhatsApp connection', request.ip);
    return { status: sessionManager.getStatus(userId).status };
  });

  fastify.post('/api/whatsapp/disconnect', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const userId = user?.id || user?.username || '';

    await sessionManager.disconnect(userId);
    await logAudit('WHATSAPP_DISCONNECT', user.username, 'Disconnected WhatsApp session', request.ip);
    return { status: 'DISCONNECTED' };
  });

  fastify.post('/api/whatsapp/pair-code', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const userId = user?.id || user?.username || '';
    const { phoneNumber } = pairCodeSchema.parse(request.body);

    try {
      const client = sessionManager.getOrCreate(userId);
      const pairingCode = await client.requestPairingCode(phoneNumber);
      await logAudit('WHATSAPP_PAIR_REQUEST', user.username, 'Requested pairing code', request.ip);
      return { code: pairingCode };
    } catch (err: any) {
      reply.status(500);
      return { error: err.message || 'Failed to generate pairing code' };
    }
  });
}
