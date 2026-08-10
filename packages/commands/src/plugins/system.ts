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
      // 🔒 SECURITY: sandboxed execution via vm.runInContext against an EMPTY
      // context global. Passing host builtins (Array/Object/Date/...) into the
      // sandbox leaks the HOST Function constructor — `Array.constructor('return
      // process')()` then reaches the real process, i.e. full RCE. With an empty
      // sandbox the context uses its own realm-bound builtins, which cannot see
      // host globals; `codeGeneration: { strings: false, wasm: false }` additionally
      // forbids eval/Function-from-string, and a 3s sync timeout caps CPU use.
      // NOTE: vm is not a hard security boundary — this command remains OWNER-ONLY.
      const sandbox: Record<string, any> = {};
      vm.createContext(sandbox);
      vm.runInContext(
        `globalThis.console = { log: (...args) => args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') };`,
        sandbox,
        { timeout: 1000, codeGeneration: { strings: false, wasm: false } } as any
      );
      const wrappedCode = `__result = (async () => { ${code} })()`;
      // `codeGeneration` is a valid runtime option (blocks Function/eval-from-string)
      // but is missing from @types/node RunningCodeOptions — cast to any.
      vm.runInContext(wrappedCode, sandbox, {
        timeout: 3000,
        codeGeneration: { strings: false, wasm: false },
      } as any);
      // SECURITY: race the awaited result against a host-side timeout so a
      // never-resolving promise inside the sandbox cannot hang the bot thread.
      const result = await Promise.race([
        sandbox.__result,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Eval timed out')), 5000)),
      ]);
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
