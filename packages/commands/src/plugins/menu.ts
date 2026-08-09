import { CommandPlugin } from '../types';
import { registry } from '../registry';

export const menuCommand: CommandPlugin = {
  name: 'menu',
  aliases: ['m', 'commands', 'helpmenu', 'list'],
  description: 'Display all 43+ available bot commands dynamically categorized',
  category: 'general',
  cooldown: 3,
  ownerOnly: false,
  enabled: true,
  handler: async ({ client, msg }) => {
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
      ADMIN: '🛡️',
      GROUP: '👥',
      AI: '🤖',
      UTILITY: '⚙️',
      FUN: '🎲',
      MEDIA: '🖼️',
      GENERAL: '📱',
      DOWNLOADER: '📥',
    };

    let text = `🔥 *CALDERA BOT — COMMAND MENU*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `• *Prefix:* \`.\`\n`;
    text += `• *Total Commands:* ${commands.length} Plugins Active\n`;
    text += `• *Status:* Connected & Operational\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const [catName, cmdList] of Object.entries(categories)) {
      const icon = categoryIcons[catName] || '📌';
      text += `${icon} *${catName} COMMANDS* (${cmdList.length})\n`;
      for (const cmd of cmdList) {
        text += ` • \`.${cmd.name}\` — ${cmd.description}\n`;
      }
      text += `\n`;
    }

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💡 *Tip:* Use \`.ping\` to check latency or \`.system\` for server diagnostics.`;

    await client.sendMessage(msg.chatId, text);
  },
};
