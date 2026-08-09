import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registry } from '@private-md-bot/commands';
import { db } from '@private-md-bot/database';
import { logAudit } from '../queue';

const updateCommandSchema = z.object({
  enabled: z.boolean().optional(),
  ownerOnly: z.boolean().optional(),
  aliases: z.array(z.string()).optional(),
  cooldown: z.number().int().min(0).optional(),
});

const executeCommandSchema = z.object({
  commandText: z.string().min(1),
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
      ...(body.ownerOnly !== undefined && { ownerOnly: body.ownerOnly }),
      ...(body.aliases !== undefined && { aliases: aliasesStr }),
      ...(body.cooldown !== undefined && { cooldown: body.cooldown }),
    });

    await logAudit('COMMAND_CONFIG_UPDATE', user.username, `Updated command ${plugin.name}`, request.ip);

    return reply.send({ command: updated });
  });

  // Test & Execute command directly from dashboard
  fastify.post('/api/commands/execute', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    const { commandText } = executeCommandSchema.parse(request.body);

    const trimmed = commandText.trim();
    const cleanCmd = trimmed.startsWith('.') ? trimmed.slice(1) : trimmed;
    const parts = cleanCmd.split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const plugin = registry.getCommand(commandName) || registry.getCommandByAlias(commandName);
    if (!plugin) {
      return reply.status(404).send({ error: `Command '.${commandName}' not found in registry.` });
    }

    let output = '';
    const mockClient: any = {
      sendMessage: async (chatId: string, content: any) => {
        if (typeof content === 'string') {
          output += content + '\n';
        } else if (content.text) {
          output += content.text + '\n';
        } else if (content.caption) {
          output += content.caption + '\n';
        } else {
          output += JSON.stringify(content, null, 2) + '\n';
        }
        return { key: { id: 'mock_msg_id' } };
      },
    };

    const mockMsg: any = {
      id: 'dash_test_msg',
      chatId: 'dashboard@s.whatsapp.net',
      senderJid: `${user.username || user.id}@s.whatsapp.net`,
      senderName: user.username || 'Admin Tester',
      body: trimmed.startsWith('.') ? trimmed : `.${trimmed}`,
      isGroup: false,
      fromMe: true,
      timestamp: Date.now(),
    };

    try {
      await plugin.handler({
        client: mockClient,
        msg: mockMsg,
        args,
        commandName: plugin.name,
      });

      await logAudit('COMMAND_TEST_EXECUTE', user.username, `Test executed command ${plugin.name}`, request.ip);

      return reply.send({
        success: true,
        command: plugin.name,
        output: output.trim() || `✓ Command .${plugin.name} executed successfully.`,
      });
    } catch (err: any) {
      return reply.send({
        success: false,
        command: plugin.name,
        output: `❌ Command execution failed: ${err.message || String(err)}`,
      });
    }
  });
}
