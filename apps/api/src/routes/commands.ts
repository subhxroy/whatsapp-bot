import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registry } from '@private-md-bot/commands';
import { db } from '@private-md-bot/database';
import { logAudit } from '../queue';

const updateCommandSchema = z.object({
  enabled: z.boolean().optional(),
  aliases: z.array(z.string()).optional(),
  cooldown: z.number().int().min(0).optional(),
});

export function registerCommandRoutes(fastify: FastifyInstance) {
  fastify.get('/api/commands', { onRequest: [fastify.authenticate] }, async () => {
    const defaultCmds = registry.getAllCommands();
    const dbConfigs = await db.getCommandConfigs();
    const dbMap = new Map(dbConfigs.map((c) => [c.name, c]));

    const merged = defaultCmds.map((cmd) => {
      const override = dbMap.get(cmd.name);
      let parsedAliases = cmd.aliases;
      if (override?.aliases) {
        try {
          parsedAliases = typeof override.aliases === 'string' ? JSON.parse(override.aliases) : override.aliases;
        } catch {
          parsedAliases = cmd.aliases;
        }
      }
      return {
        name: cmd.name,
        aliases: parsedAliases,
        description: cmd.description,
        category: cmd.category,
        ownerOnly: override ? override.ownerOnly : cmd.ownerOnly,
        enabled: override ? override.enabled : cmd.enabled,
        cooldown: override ? override.cooldown : cmd.cooldown,
      };
    });

    return { commands: merged };
  });

  fastify.put('/api/commands/:name', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { name } = request.params as { name: string };
    const body = updateCommandSchema.parse(request.body);

    const plugin = registry.getCommand(name);
    if (!plugin) {
      reply.status(404);
      return { error: 'Command not found' };
    }

    const aliasesStr = body.aliases !== undefined ? JSON.stringify(body.aliases) : undefined;

    const updated = await db.upsertCommandConfig({
      name: plugin.name,
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      ...(body.aliases !== undefined && { aliases: aliasesStr }),
      ...(body.cooldown !== undefined && { cooldown: body.cooldown }),
    });

    await logAudit('COMMAND_CONFIG_UPDATE', user.username, `Updated command ${plugin.name}`, request.ip);

    return { command: updated };
  });
}
