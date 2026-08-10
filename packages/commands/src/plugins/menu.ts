import { CommandPlugin } from '../types';
import { registry } from '../registry';

export const menuCommand: CommandPlugin = {
  name: 'menu',
  aliases: ['m', 'commands', 'helpmenu', 'list'],
  description: 'Display all 50+ available bot commands dynamically categorized',
  category: 'general',
  cooldown: 3,
  ownerOnly: true,
  enabled: true,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    const commands = registry.getAllCommands();
    const categories: Record<string, CommandPlugin[]> = {};

    for (const cmd of commands) {
      if (!cmd.enabled) continue;
      const cat = (cmd.category || 'general').toUpperCase();
      if (!categories[cat]) {
        categories[cat] = [];
      }
      categories[cat].push(cmd);
    }

    const categoryIcons: Record<string, string> = {
      ADMIN: 'ðŸ›¡ï¸',
      GROUP: 'ðŸ‘¥',
      AI: 'ðŸ¤–',
      UTILITY: 'âš™ï¸',
      FUN: 'ðŸŽ²',
      MEDIA: 'ðŸ–¼ï¸',
      GENERAL: 'ðŸ“±',
      DOWNLOADER: 'ðŸ“¥',
    };

    let text = `ðŸ”¥ *CALDERA BOT â€” COMMAND MENU*\n`;
    text += `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n`;
    text += `â€¢ *Prefix:* \`.\`\n`;
    text += `â€¢ *Total Commands:* ${commands.length} Plugins Active\n`;
    text += `â€¢ *Status:* Connected & Operational\n`;
    text += `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\n`;

    for (const [catName, cmdList] of Object.entries(categories)) {
      const icon = categoryIcons[catName] || 'ðŸ“Œ';
      text += `${icon} *${catName} COMMANDS* (${cmdList.length})\n`;
      for (const cmd of cmdList) {
        text += ` â€¢ \`.${cmd.name}\` â€” ${cmd.description}\n`;
      }
      text += `\n`;
    }

    text += `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n`;
    text += `ðŸ’¡ *Tip:* Use \`.ping\` to check latency or \`.system\` for server diagnostics.`;

    await client.sendMessage(activeMsg.chatId, text);
  },
};
