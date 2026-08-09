import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@private-md-bot/database';
import { logAudit } from '../queue';

const createScheduleSchema = z.object({
  targetNumber: z.string().min(3),
  message: z.string().min(1),
  scheduledAt: z.string().min(10),
  type: z.enum(['SCHEDULED', 'BIRTHDAY']).optional().default('SCHEDULED'),
});

export function registerScheduledMessageRoutes(fastify: FastifyInstance) {
  // Get all scheduled messages
  fastify.get('/api/scheduled-messages', { onRequest: [fastify.authenticate] }, async () => {
    const messages = await db.getScheduledMessages();
    return { messages };
  });

  // Create a new scheduled message
  fastify.post('/api/scheduled-messages', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const body = createScheduleSchema.parse(request.body);

    const cleanDigits = body.targetNumber.replace(/\D/g, '');
    if (!cleanDigits) {
      return reply.status(400).send({ error: 'Invalid target phone number' });
    }

    const targetJid = `${cleanDigits}@s.whatsapp.net`;
    const senderJid = `${user.username || user.id}@s.whatsapp.net`;

    const scheduled = await db.createScheduledMessage({
      targetNumber: cleanDigits,
      targetJid,
      message: body.message,
      scheduledAt: body.scheduledAt,
      senderJid,
      type: body.type,
    });

    await logAudit('SCHEDULED_MESSAGE_CREATE', user.username, `Scheduled message to ${cleanDigits} at ${body.scheduledAt}`, request.ip);

    return reply.send({ message: scheduled });
  });

  // Delete / cancel a scheduled message
  fastify.delete('/api/scheduled-messages/:id', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    await db.deleteScheduledMessage(id);

    await logAudit('SCHEDULED_MESSAGE_DELETE', user.username, `Deleted scheduled message ${id}`, request.ip);

    return { success: true };
  });
}
