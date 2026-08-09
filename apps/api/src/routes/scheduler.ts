import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@private-md-bot/database';
import { logAudit } from '../queue';

const EXEMPT_EMAILS = ['contact.subhroy@gmail.com', 'aarxslan@gmail.com', 'admin', 'admin@openify.studio'];

function checkAdmin(user: any): boolean {
  if (!user) return false;
  const identifier = (user.email || user.username || user.id || '').toLowerCase();
  return EXEMPT_EMAILS.some((e) => e.toLowerCase() === identifier) || user.role === 'ADMIN' || user.role === 'OWNER';
}

const createScheduleSchema = z.object({
  targetNumber: z.string().min(3),
  message: z.string().min(1),
  scheduledAt: z.string().min(10),
  type: z.enum(['SCHEDULED', 'BIRTHDAY']).optional().default('SCHEDULED'),
});

export function registerScheduledMessageRoutes(fastify: FastifyInstance) {
  // Get scheduled messages for authenticated user (or all if admin)
  fastify.get('/api/scheduled-messages', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const isAdmin = checkAdmin(user);
    const userId = user?.id || user?.username || '';

    const messages = await db.getScheduledMessages(userId, isAdmin);
    return { messages };
  });

  // Create a new scheduled message
  fastify.post('/api/scheduled-messages', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const userId = user?.id || user?.username || '';
    const body = createScheduleSchema.parse(request.body);

    const cleanDigits = body.targetNumber.replace(/\D/g, '');
    if (!cleanDigits) {
      return reply.status(400).send({ error: 'Invalid target phone number' });
    }

    const targetJid = `${cleanDigits}@s.whatsapp.net`;
    const senderJid = `${user.username || user.id}@s.whatsapp.net`;

    const scheduled = await db.createScheduledMessage({
      userId,
      targetNumber: cleanDigits,
      targetJid,
      message: body.message,
      scheduledAt: body.scheduledAt,
      senderJid,
      type: body.type,
    });

    await logAudit('SCHEDULED_MESSAGE_CREATE', user.username || userId, `Scheduled message to ${cleanDigits} at ${body.scheduledAt}`, request.ip);

    return reply.send({ message: scheduled });
  });

  // Delete / cancel a scheduled message
  fastify.delete('/api/scheduled-messages/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = checkAdmin(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const success = await db.deleteScheduledMessage(id, userId, isAdmin);

    if (!success) {
      reply.status(403);
      return { error: 'Unauthorized or scheduled message not found' };
    }

    await logAudit('SCHEDULED_MESSAGE_DELETE', user.username || userId, `Deleted scheduled message ${id}`, request.ip);

    return { success: true };
  });
}
