import { CommandPlugin } from '../types';
import { registry } from '../registry';

export const helpCommand: CommandPlugin = {
  name: 'help',
  aliases: ['h', 'info'],
  description: 'Get details about a specific command',
  category: 'general',
  ownerOnly: false,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const query = ctx.args[0]?.toLowerCase();
    if (!query) {
      return await ctx.reply(`Use \`${ctx.prefix}menu\` to see all commands, or \`${ctx.prefix}help <command>\` for command details.`);
    }

    const cmd = registry.getCommand(query);
    if (!cmd) {
      return await ctx.reply(`❌ Command \`${query}\` not found.`);
    }

    const text = `ℹ️ *Command Information:*
• *Name:* ${cmd.name}
• *Aliases:* ${cmd.aliases.length > 0 ? cmd.aliases.join(', ') : 'None'}
• *Category:* ${cmd.category}
• *Description:* ${cmd.description}
• *Owner Only:* ${cmd.ownerOnly ? 'Yes' : 'No'}
• *Cooldown:* ${cmd.cooldown}s`;

    await ctx.reply(text);
  },
};
