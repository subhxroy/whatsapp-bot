import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@private-md-bot/database';
import type { ScheduleStatus } from '@private-md-bot/database';
import { cleanPhoneNumber, isScheduleEditable, isValidPhoneNumber } from '@private-md-bot/database';
import { isAdminUser } from '@private-md-bot/security';
import { logAudit } from '../queue';

const ALLOWED_STATUSES = new Set<ScheduleStatus>([
  'PENDING',
  'SENT',
  'FAILED',
  'PROCESSING',
  'PAUSED',
  'CANCELLED',
  'DRAFT',
]);

const createScheduleSchema = z.object({
  targetNumber: z.string().min(3).max(20),
  message: z.string().min(1).max(4096),
  scheduledAt: z.string().min(10),
  type: z.enum(['SCHEDULED', 'BIRTHDAY']).optional().default('SCHEDULED'),
  title: z.string().max(120).optional(),
});

const updateScheduleSchema = z
  .object({
    targetNumber: z.string().min(3).max(20).optional(),
    message: z.string().min(1).max(4096).optional(),
    scheduledAt: z.string().min(10).optional(),
    type: z.enum(['SCHEDULED', 'BIRTHDAY']).optional(),
    title: z.string().max(120).optional().nullable(),
  })
  .refine((v) => Object.keys(v).some((k) => (v as any)[k] !== undefined && (v as any)[k] !== null), {
    message: 'No fields to update',
  });

const listQuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().max(20).optional(),
  type: z.enum(['BIRTHDAY', 'SCHEDULED']).optional(),
  sort: z.enum(['scheduledAt', 'createdAt', 'updatedAt']).optional().default('scheduledAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

function toPage(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

function isFutureIso(value: string): boolean {
  const t = new Date(value).getTime();
  return !isNaN(t) && t > Date.now();
}

export function registerScheduledMessageRoutes(fastify: FastifyInstance) {
  // List scheduled messages (with search / filter / sort / pagination)
  fastify.get('/api/scheduled-messages', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const q = listQuerySchema.parse(request.query || {});
    const status = q.status && ALLOWED_STATUSES.has(q.status as ScheduleStatus) ? q.status : undefined;

    const { messages, total } = await db.listScheduledMessages({
      userId,
      isOwnerOrAdmin: isAdmin,
      search: q.search,
      status,
      type: q.type,
      sort: q.sort,
      order: q.order,
      page: toPage(q.page, 1),
      pageSize: toPage(q.pageSize, 50),
    });
    return { messages, total, page: toPage(q.page, 1), pageSize: toPage(q.pageSize, 50) };
  });

  // Detail view for a single scheduled message
  fastify.get('/api/scheduled-messages/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const message = await db.getScheduledMessage(id, userId, isAdmin);
    if (!message) {
      return reply.status(404).send({ error: 'Scheduled message not found' });
    }
    return { message };
  });

  // Create a new scheduled message
  fastify.post(
    '/api/scheduled-messages',
    { onRequest: [fastify.authenticate], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
    const user = (request as any).user;
    const userId = user?.id || user?.username || '';
    const body = createScheduleSchema.parse(request.body);

    const cleanDigits = cleanPhoneNumber(body.targetNumber);
    if (!isValidPhoneNumber(cleanDigits)) {
      return reply.status(400).send({ error: 'Invalid target phone number (must be 7-15 digits with country code)' });
    }
    if (!isFutureIso(body.scheduledAt)) {
      return reply.status(400).send({ error: 'scheduledAt must be a valid future date/time' });
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
      title: body.title,
    });

    await db.createMessageEvent({
      scheduleId: scheduled.id,
      userId,
      eventType: 'SCHEDULE_CREATED',
      status: 'PENDING',
      targetNumber: cleanDigits,
    });
    await logAudit(
      'SCHEDULED_MESSAGE_CREATE',
      user.username || userId,
      `Scheduled message to ${cleanDigits} at ${body.scheduledAt}`,
      request.ip
    );

    return reply.send({ message: scheduled });
  });

  // Edit an existing scheduled message (only while in an editable state)
  fastify.put('/api/scheduled-messages/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };
    const body = updateScheduleSchema.parse(request.body);

    const existing = await db.getScheduledMessage(id, userId, isAdmin);
    if (!existing) {
      return reply.status(404).send({ error: 'Scheduled message not found' });
    }
    if (!isScheduleEditable(existing.status)) {
      return reply
        .status(409)
        .send({ error: `Scheduled message in status '${existing.status}' cannot be edited` });
    }
    if (body.scheduledAt !== undefined && !isFutureIso(body.scheduledAt)) {
      return reply.status(400).send({ error: 'scheduledAt must be a valid future date/time' });
    }
    if (body.targetNumber !== undefined) {
      const cleanDigits = cleanPhoneNumber(body.targetNumber);
      if (!isValidPhoneNumber(cleanDigits)) {
        return reply.status(400).send({ error: 'Invalid target phone number (must be 7-15 digits with country code)' });
      }
      body.targetNumber = cleanDigits;
    }

    const updated = await db.updateScheduledMessage(
      id,
      {
        message: body.message,
        scheduledAt: body.scheduledAt,
        type: body.type,
        targetNumber: body.targetNumber,
        title: body.title ?? undefined,
      },
      userId,
      isAdmin
    );

    if (!updated) {
      return reply.status(404).send({ error: 'Scheduled message not found' });
    }

    await db.createMessageEvent({
      scheduleId: id,
      userId,
      eventType: 'SCHEDULE_UPDATED',
      status: updated.status,
      targetNumber: updated.targetNumber,
    });
    await logAudit('SCHEDULED_MESSAGE_UPDATE', user.username || userId, `Updated scheduled message ${id}`, request.ip);

    return reply.send({ message: updated });
  });

  // Duplicate an existing scheduled message
  fastify.post('/api/scheduled-messages/:id/duplicate', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const copy = await db.duplicateScheduledMessage(id, userId, isAdmin);
    if (!copy) {
      return reply.status(404).send({ error: 'Scheduled message not found' });
    }

    await db.createMessageEvent({
      scheduleId: copy.id,
      userId,
      eventType: 'SCHEDULE_DUPLICATED',
      status: 'PENDING',
      targetNumber: copy.targetNumber,
    });
    await logAudit('SCHEDULED_MESSAGE_DUPLICATE', user.username || userId, `Duplicated scheduled message ${id} -> ${copy.id}`, request.ip);

    return reply.send({ message: copy });
  });

  // Cancel (soft) — stops delivery and keeps the record for the audit trail
  fastify.post('/api/scheduled-messages/:id/cancel', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const existing = await db.getScheduledMessage(id, userId, isAdmin);
    if (!existing) {
      return reply.status(404).send({ error: 'Scheduled message not found' });
    }
    const updated = await db.transitionScheduledMessage(id, ['PENDING', 'PAUSED', 'DRAFT', 'FAILED'], 'CANCELLED', userId, isAdmin);
    if (!updated) {
      return reply.status(409).send({ error: `Scheduled message in status '${existing.status}' cannot be cancelled` });
    }

    await db.createMessageEvent({
      scheduleId: id,
      userId,
      eventType: 'SCHEDULE_CANCELLED',
      status: 'CANCELLED',
      targetNumber: updated.targetNumber,
    });
    await logAudit('SCHEDULED_MESSAGE_CANCEL', user.username || userId, `Cancelled scheduled message ${id}`, request.ip);

    return reply.send({ message: updated });
  });

  // Pause — keeps the record, halts delivery
  fastify.post('/api/scheduled-messages/:id/pause', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const existing = await db.getScheduledMessage(id, userId, isAdmin);
    if (!existing) {
      return reply.status(404).send({ error: 'Scheduled message not found' });
    }
    const updated = await db.transitionScheduledMessage(id, ['PENDING', 'FAILED'], 'PAUSED', userId, isAdmin);
    if (!updated) {
      return reply.status(409).send({ error: `Scheduled message in status '${existing.status}' cannot be paused` });
    }

    await db.createMessageEvent({
      scheduleId: id,
      userId,
      eventType: 'SCHEDULE_PAUSED',
      status: 'PAUSED',
      targetNumber: updated.targetNumber,
    });
    await logAudit('SCHEDULED_MESSAGE_PAUSE', user.username || userId, `Paused scheduled message ${id}`, request.ip);

    return reply.send({ message: updated });
  });

  // Resume a paused schedule
  fastify.post('/api/scheduled-messages/:id/resume', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const existing = await db.getScheduledMessage(id, userId, isAdmin);
    if (!existing) {
      return reply.status(404).send({ error: 'Scheduled message not found' });
    }
    const updated = await db.transitionScheduledMessage(id, ['PAUSED'], 'PENDING', userId, isAdmin);
    if (!updated) {
      return reply.status(409).send({ error: `Scheduled message in status '${existing.status}' cannot be resumed` });
    }

    await db.createMessageEvent({
      scheduleId: id,
      userId,
      eventType: 'SCHEDULE_RESUMED',
      status: 'PENDING',
      targetNumber: updated.targetNumber,
    });
    await logAudit('SCHEDULED_MESSAGE_RESUME', user.username || userId, `Resumed scheduled message ${id}`, request.ip);

    return reply.send({ message: updated });
  });

  // Retry a failed delivery
  fastify.post('/api/scheduled-messages/:id/retry', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const existing = await db.getScheduledMessage(id, userId, isAdmin);
    if (!existing) {
      return reply.status(404).send({ error: 'Scheduled message not found' });
    }
    const updated = await db.transitionScheduledMessage(id, ['FAILED'], 'PENDING', userId, isAdmin);
    if (!updated) {
      return reply.status(409).send({ error: `Scheduled message in status '${existing.status}' cannot be retried` });
    }

    await db.createMessageEvent({
      scheduleId: id,
      userId,
      eventType: 'SCHEDULE_RETRIED',
      status: 'PENDING',
      targetNumber: updated.targetNumber,
    });
    await logAudit('SCHEDULED_MESSAGE_RETRY', user.username || userId, `Retried scheduled message ${id}`, request.ip);

    return reply.send({ message: updated });
  });

  // Delivery history for a schedule
  fastify.get('/api/scheduled-messages/:id/events', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const events = await db.getMessageEventsForSchedule(id, userId, isAdmin);
    return { events };
  });

  // Delete / cancel a scheduled message (hard delete)
  fastify.delete('/api/scheduled-messages/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const existing = await db.getScheduledMessage(id, userId, isAdmin);
    if (!existing) {
      return reply.status(404).send({ error: 'Scheduled message not found' });
    }

    const success = await db.deleteScheduledMessage(id, userId, isAdmin);
    if (!success) {
      return reply.status(403).send({ error: 'Unauthorized or scheduled message not found' });
    }

    await db.createMessageEvent({
      scheduleId: id,
      userId,
      eventType: 'SCHEDULE_DELETED',
      status: existing.status,
      targetNumber: existing.targetNumber,
    });
    await logAudit('SCHEDULED_MESSAGE_DELETE', user.username || userId, `Deleted scheduled message ${id}`, request.ip);

    return { success: true };
  });
}
