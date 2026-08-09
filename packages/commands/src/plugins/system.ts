import os from 'os';
import { CommandPlugin } from '../types';

export const systemCommand: CommandPlugin = {
  name: 'system',
  aliases: ['sys', 'sysinfo', 'server'],
  description: 'Display detailed server memory, CPU usage, Node uptime, and OS platform stats',
  category: 'general',
  cooldown: 5,
  ownerOnly: false,
  enabled: true,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    const freeMem = (os.freemem() / (1024 * 1024)).toFixed(0);
    const totalMem = (os.totalmem() / (1024 * 1024)).toFixed(0);
    const usedMem = (Number(totalMem) - Number(freeMem)).toFixed(0);
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Unknown CPU';
    const uptimeSec = process.uptime();
    const uptimeHours = (uptimeSec / 3600).toFixed(2);

    const report = `💻 *System & Server Diagnostics*\n\n` +
      `• *OS Platform:* ${os.platform()} (${os.arch()})\n` +
      `• *Node.js Version:* ${process.version}\n` +
      `• *Uptime:* ${uptimeHours} hours\n` +
      `• *Memory Usage:* ${usedMem} MB / ${totalMem} MB (${freeMem} MB free)\n` +
      `• *CPU Model:* ${cpuModel} (${cpus.length} cores)\n` +
      `• *Process PID:* ${process.pid}`;

    await client.sendMessage(activeMsg.chatId, report);
  },
};

export const evalCommand: CommandPlugin = {
  name: 'eval',
  aliases: ['e', 'js'],
  description: 'Execute JavaScript code in sandbox (Owner-Only)',
  category: 'admin',
  cooldown: 0,
  ownerOnly: true,
  enabled: true,
  execute: async ({ client, msg, message = msg, args }: any) => {
    const activeMsg = msg || message;
    const code = args.join(' ').trim();
    if (!code) {
      await client.sendMessage(activeMsg.chatId, '⚠️ Usage: `.eval <code>`');
      return;
    }

    try {
      const result = await eval(`(async () => { ${code} })()`);
      const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
      await client.sendMessage(activeMsg.chatId, `⚡ *Eval Result:*\n\`\`\`${output}\`\`\``);
    } catch (err: any) {
      await client.sendMessage(activeMsg.chatId, `❌ *Eval Error:*\n\`\`\`${err.message || String(err)}\`\`\``);
    }
  },
};

export const restartCommand: CommandPlugin = {
  name: 'restart',
  aliases: ['reboot'],
  description: 'Restart bot WhatsApp session (Owner-Only)',
  category: 'admin',
  cooldown: 10,
  ownerOnly: true,
  enabled: true,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    await client.sendMessage(activeMsg.chatId, '🔄 *Restarting WhatsApp bot session...*');
    try {
      await client.reconnect();
    } catch (err: any) {
      await client.sendMessage(activeMsg.chatId, `❌ Restart error: ${err.message}`);
    }
  },
};
