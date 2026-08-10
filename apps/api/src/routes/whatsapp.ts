import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SessionManager } from '../session-manager';
import { assertCanConnectWhatsApp } from '../payment-gate';
import { safePairCodeError } from '../safe-errors';
import { logAudit } from '../queue';

const pairCodeSchema = z.object({
  phoneNumber: z.string().min(8).max(20),
});

// CANONICAL SESSION ID: session keys are built from `username` (stable login
// name / Google email) because the payment flow stores the same identifier as
// `userEmail`. connect/pair-code/approve/revoke/startup must ALL resolve to the
// same session key; previously connect used `user.id` (Firestore doc id) while
// payment used `username`, creating two independent sessions per user — and
// `disconnect(user.id)` silently missed the payment-created session.
function canonicalSessionId(user: any): string {
  return user?.username || user?.id || '';
}

export function registerWhatsAppRoutes(fastify: FastifyInstance, sessionManager: SessionManager) {
  fastify.get('/api/whatsapp/status', { onRequest: [fastify.authenticate] }, async (request) => {
    const userId = canonicalSessionId((request as any).user);

    const { status, qrCode } = sessionManager.getStatus(userId);
    return { status, qrCode };
  });

  fastify.post(
    '/api/whatsapp/connect',
    { onRequest: [fastify.authenticate], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
    const user = (request as any).user;
    const userId = canonicalSessionId(user);

    // SECURITY: the payment-approval gate is the single authoritative check for
    // establishing a WhatsApp session. Manual connect must not bypass it.
    if (!(await assertCanConnectWhatsApp(user, reply))) return;

    await sessionManager.connect(userId);
    await logAudit('WHATSAPP_CONNECT', user.username, 'Initiated WhatsApp connection', request.ip);
    return { status: sessionManager.getStatus(userId).status };
  });

  fastify.post('/api/whatsapp/disconnect', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const userId = canonicalSessionId(user);

    await sessionManager.disconnect(userId);
    await logAudit('WHATSAPP_DISCONNECT', user.username, 'Disconnected WhatsApp session', request.ip);
    return { status: 'DISCONNECTED' };
  });

  fastify.post(
    '/api/whatsapp/pair-code',
    { onRequest: [fastify.authenticate], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
    const user = (request as any).user;
    const userId = canonicalSessionId(user);
    const { phoneNumber } = pairCodeSchema.parse(request.body);

    // SECURITY: pairing is an alternative connect path — same gate.
    if (!(await assertCanConnectWhatsApp(user, reply))) return;

    try {
      const client = sessionManager.getOrCreate(userId);
      const pairingCode = await client.requestPairingCode(phoneNumber);
      await logAudit('WHATSAPP_PAIR_REQUEST', user.username, 'Requested pairing code', request.ip);
      return { code: pairingCode };
    } catch (err) {
      // SECURITY: never leak the raw exception (Baileys/Firebase internals,
      // filesystem paths, tokens) to the client. Log it server-side only.
      fastify.log.error({ err, userId, phoneNumber }, 'Failed to generate WhatsApp pairing code');
      const safe = safePairCodeError(err);
      reply.status(safe.statusCode);
      return safe.body;
    }
  });
}
