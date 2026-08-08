import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WhatsAppClient } from '@private-md-bot/whatsapp';
import { logAudit } from '../queue';

const pairCodeSchema = z.object({
  phoneNumber: z.string().min(8),
});

export function registerWhatsAppRoutes(fastify: FastifyInstance, waClient: WhatsAppClient) {
  fastify.get('/api/whatsapp/status', { onRequest: [fastify.authenticate] }, async () => {
    return {
      status: waClient.getStatus(),
      qrCode: waClient.getQRCode(),
    };
  });

  fastify.post('/api/whatsapp/connect', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    await waClient.connect();
    await logAudit('WHATSAPP_CONNECT', user.username, 'Initiated WhatsApp connection', request.ip);
    return { status: waClient.getStatus() };
  });

  fastify.post('/api/whatsapp/disconnect', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    await waClient.disconnect();
    await logAudit('WHATSAPP_DISCONNECT', user.username, 'Disconnected WhatsApp session', request.ip);
    return { status: waClient.getStatus() };
  });

  fastify.post('/api/whatsapp/pair-code', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { phoneNumber } = pairCodeSchema.parse(request.body);

    try {
      const pairingCode = await waClient.requestPairingCode(phoneNumber);
      await logAudit('WHATSAPP_PAIR_REQUEST', user.username, 'Requested pairing code', request.ip);
      return { code: pairingCode };
    } catch (err: any) {
      reply.status(500);
      return { error: err.message || 'Failed to generate pairing code' };
    }
  });
}
