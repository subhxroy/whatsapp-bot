import { CommandPlugin } from '../types';
import { registry } from '../registry';

export const menuCommand: CommandPlugin = {
  name: 'menu',
  aliases: ['m', 'commands', 'helpmenu'],
  description: 'Display all available commands dynamically',
  category: 'general',
  ownerOnly: false,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const commands = registry.getAllCommands();
    const categories: Record<string, CommandPlugin[]> = {};

    for (const cmd of commands) {
      if (!cmd.enabled) continue;
      if (cmd.ownerOnly && ctx.callerRole !== 'OWNER') continue;

      if (!categories[cmd.category]) {
        categories[cmd.category] = [];
      }
      categories[cmd.category].push(cmd);
    }

    let menuText = `📱 *PRIVATE WHATSAPP BOT MENU*\nPrefix: \`${ctx.prefix}\`\n\n`;

    for (const [cat, cmds] of Object.entries(categories)) {
      menuText += `*${cat.toUpperCase()}*\n`;
      for (const cmd of cmds) {
        menuText += `• \`${ctx.prefix}${cmd.name}\`: ${cmd.description}\n`;
      }
      menuText += `\n`;
    }

    menuText += `_Type \`${ctx.prefix}help <command>\` for detailed usage._`;

    await ctx.reply(menuText);
  },
};
