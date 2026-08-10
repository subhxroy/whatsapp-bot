import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@private-md-bot/database';
import { isAdminUser } from '@private-md-bot/security';
import { logAudit } from '../queue';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  message: z.string().min(1).max(4096),
  type: z.enum(['SCHEDULED', 'BIRTHDAY']).optional().default('SCHEDULED'),
});

const updateTemplateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    message: z.string().min(1).max(4096).optional(),
    type: z.enum(['SCHEDULED', 'BIRTHDAY']).optional(),
  })
  .refine((v) => Object.keys(v).some((k) => (v as any)[k] !== undefined), { message: 'No fields to update' });

export function registerTemplateRoutes(fastify: FastifyInstance) {
  fastify.get('/api/templates', { onRequest: [fastify.authenticate] }, async (request) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';

    const templates = await db.listTemplates(userId, isAdmin);
    return { templates };
  });

  fastify.post('/api/templates', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const userId = user?.id || user?.username || '';
    const body = createTemplateSchema.parse(request.body);

    const template = await db.createTemplate({
      userId,
      name: body.name.trim(),
      message: body.message.trim(),
      type: body.type,
    });

    await logAudit('TEMPLATE_CREATE', user.username || userId, `Created template '${template.name}'`, request.ip);
    return reply.send({ template });
  });

  fastify.put('/api/templates/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };
    const body = updateTemplateSchema.parse(request.body);

    const updated = await db.updateTemplate(id, body, userId, isAdmin);
    if (!updated) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    await logAudit('TEMPLATE_UPDATE', user.username || userId, `Updated template '${updated.name}'`, request.ip);
    return reply.send({ template: updated });
  });

  fastify.delete('/api/templates/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminUser(user);
    const userId = user?.id || user?.username || '';
    const { id } = request.params as { id: string };

    const existing = await db.getTemplate(id, userId, isAdmin);
    if (!existing) {
      return reply.status(404).send({ error: 'Template not found' });
    }
    const success = await db.deleteTemplate(id, userId, isAdmin);
    if (!success) {
      return reply.status(403).send({ error: 'Unauthorized or template not found' });
    }

    await logAudit('TEMPLATE_DELETE', user.username || userId, `Deleted template '${existing.name}'`, request.ip);
    return { success: true };
  });
}
