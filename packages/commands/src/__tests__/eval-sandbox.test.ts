import { describe, it, expect, vi } from 'vitest';
import { evalCommand } from '../plugins/system';

function makeClient() {
  const sent: Array<{ chatId: string; content: string }> = [];
  const client: any = {
    sent,
    sendMessage: vi.fn(async (chatId: string, content: string) => {
      sent.push({ chatId, content });
      return { key: { id: 'mock' } };
    }),
  };
  return client;
}

function runEval(args: string[], client: any) {
  return (evalCommand.execute as any)({ client, msg: { chatId: 'x' }, args });
}

describe('evalCommand — sandbox hardening', () => {
  it('evaluates safe expressions', async () => {
    const client = makeClient();
    await runEval(['return 1 + 2'], client);
    expect(client.sent[0].content).toContain('Eval Result');
    expect(client.sent[0].content).toContain('3');
  });

  it('blocks the classic vm escape chain (Array.constructor -> Function -> process)', async () => {
    const client = makeClient();
    await runEval([`return Array.constructor('return process')()`], client);
    expect(client.sent[0].content).toContain('Eval Error');
  });

  it('eval stays confined to the sandbox realm (no host process access)', async () => {
    const client = makeClient();
    await runEval([`return eval('typeof process')`], client);
    expect(client.sent[0].content).toContain('undefined');
  });

  it('sandbox has no host process/require access', async () => {
    const client = makeClient();
    await runEval([`return typeof process + '|' + typeof require`], client);
    expect(client.sent[0].content).toContain('undefined|undefined');
  });
});
