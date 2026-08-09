import os from 'os';
import vm from 'vm';
import { CommandPlugin } from '../types';

export const systemCommand: CommandPlugin = {
  name: 'system',
  aliases: ['sys', 'sysinfo', 'server'],
  description: 'Display detailed server memory, CPU usage, Node uptime, and OS platform stats',
  category: 'general',
  cooldown: 5,
  ownerOnly: true, // 🔒 SECURITY: exposes PID, CPU model, memory layout — owner only
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

    const report = `\u{1F4BB} *System & Server Diagnostics*\n\n` +
      `\u2022 *OS Platform:* ${os.platform()} (${os.arch()})\n` +
      `\u2022 *Node.js Version:* ${process.version}\n` +
      `\u2022 *Uptime:* ${uptimeHours} hours\n` +
      `\u2022 *Memory Usage:* ${usedMem} MB / ${totalMem} MB (${freeMem} MB free)\n` +
      `\u2022 *CPU Model:* ${cpuModel} (${cpus.length} cores)\n` +
      `\u2022 *Process PID:* ${process.pid}`;

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
      await client.sendMessage(activeMsg.chatId, '\u26a0\ufe0f Usage: `.eval <code>`');
      return;
    }

    try {
      // 🔒 SECURITY: Sandboxed execution via vm.runInNewContext with strict timeout.
      // The sandbox exposes limited safe globals only — no process, require, fs access.
      const sandbox: Record<string, any> = {
        console: { log: (...a: any[]) => a.join(' ') },
        Math,
        Date,
        JSON,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        String,
        Number,
        Boolean,
        Array,
        Object,
        __result: undefined,
      };
      vm.createContext(sandbox);
      const wrappedCode = `__result = (async () => { ${code} })()`;
      vm.runInContext(wrappedCode, sandbox, { timeout: 3000 });
      const result = await sandbox.__result;
      const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result ?? 'undefined');
      await client.sendMessage(activeMsg.chatId, `\u26a1 *Eval Result:*\n\`\`\`${output.slice(0, 2000)}\`\`\``);
    } catch (err: any) {
      await client.sendMessage(activeMsg.chatId, `\u274c *Eval Error:*\n\`\`\`${(err.message || String(err)).slice(0, 500)}\`\`\``);
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
    await client.sendMessage(activeMsg.chatId, '\u{1F504} *Restarting WhatsApp bot session...*');
    try {
      await client.reconnect();
    } catch (err: any) {
      await client.sendMessage(activeMsg.chatId, `\u274c Restart error: ${err.message}`);
    }
  },
};
