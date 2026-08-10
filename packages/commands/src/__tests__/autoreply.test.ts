import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NormalizedMessage } from '@private-md-bot/whatsapp';

const dbMock = vi.hoisted(() => ({
  getEnabledAutoReplies: vi.fn(async (userId?: string): Promise<any[]> => []),
}));

vi.mock('@private-md-bot/database', () => ({ db: dbMock }));

import { processAutoReplies } from '../auto-reply';

function makeClient() {
  const sent: Array<{ chatId: string; content: any }> = [];
  const client: any = {
    sent,
    sendMessage: vi.fn(async (chatId: string, content: any) => {
      sent.push({ chatId, content });
      return { key: { id: 'mock' } };
    }),
    getUserId: vi.fn(() => 'user-1'),
  };
  return client;
}

function makeMsg(senderJid: string, body: string): NormalizedMessage {
  return {
    id: 'msg_1',
    chatId: senderJid,
    senderJid,
    senderNumber: senderJid.split('@')[0],
    senderResolved: true,
    pushName: undefined,
    fromMe: false,
    isGroup: false,
    body,
    hasMedia: false,
    isViewOnce: false,
    rawMessage: {},
  };
}

describe('processAutoReplies — specificNumber phone matching', () => {
  let client: ReturnType<typeof makeClient>;

  function ruleWithNumber(id: string, num: string) {
    return {
      id,
      trigger: '*',
      matchType: 'ANY',
      specificNumber: num,
      response: 'matched',
      enabled: true,
      priority: 1,
      cooldown: 5,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
    dbMock.getEnabledAutoReplies.mockResolvedValue([]);
  });

  it('matches exact full-number rule', async () => {
    dbMock.getEnabledAutoReplies.mockResolvedValue([ruleWithNumber('phone-exact', '917000000000')]);
    await processAutoReplies(client, makeMsg('917000000000@s.whatsapp.net', 'hello'));
    expect(client.sent.length).toBe(1);
  });

  it('does NOT match a different number that merely ends with the rule number', async () => {
    // 1917000000000 ends with 917000000000 but is a DIFFERENT phone number.
    dbMock.getEnabledAutoReplies.mockResolvedValue([ruleWithNumber('phone-cross', '917000000000')]);
    await processAutoReplies(client, makeMsg('1917000000000@s.whatsapp.net', 'hello'));
    expect(client.sent.length).toBe(0);
  });

  it('still allows local-format suffix matching (rule without country code)', async () => {
    // Local 10-digit rule must still match the same number with a country code.
    dbMock.getEnabledAutoReplies.mockResolvedValue([ruleWithNumber('phone-local', '7000000000')]);
    await processAutoReplies(client, makeMsg('917000000000@s.whatsapp.net', 'hello'));
    expect(client.sent.length).toBe(1);
  });

  it('still allows short partial-number matching', async () => {
    dbMock.getEnabledAutoReplies.mockResolvedValue([ruleWithNumber('phone-partial', '700000')]);
    await processAutoReplies(client, makeMsg('917000700000@s.whatsapp.net', 'hello'));
    expect(client.sent.length).toBe(1);
  });
});

describe('processAutoReplies — REGEX trigger ReDoS protection', () => {
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
    dbMock.getEnabledAutoReplies.mockResolvedValue([]);
  });

  it('executes safe REGEX triggers normally', async () => {
    dbMock.getEnabledAutoReplies.mockResolvedValue([
      {
        id: 'safe-1',
        trigger: '\\d{4}',
        matchType: 'REGEX',
        specificNumber: null,
        response: 'Found a 4-digit number',
        enabled: true,
        priority: 1,
        cooldown: 5,
      },
    ]);
    await processAutoReplies(client, makeMsg('916000619381@s.whatsapp.net', 'order id 4821 done'));
    expect(client.sent.length).toBe(1);
    expect(client.sent[0].content).toBe('Found a 4-digit number');
  });

  it('rejects catastrophic-backtracking REGEX triggers without hanging', async () => {
    dbMock.getEnabledAutoReplies.mockResolvedValue([
      {
        id: 'redos-1',
        trigger: '(a+)+$',
        matchType: 'REGEX',
        specificNumber: null,
        response: 'should never reply',
        enabled: true,
        priority: 1,
        cooldown: 5,
      },
    ]);
    // A long matching-ish input would hang a naive engine; the guard must skip it fast.
    const start = Date.now();
    await processAutoReplies(client, makeMsg('917000000001@s.whatsapp.net', 'a'.repeat(2000)));
    const elapsed = Date.now() - start;
    expect(client.sent.length).toBe(0);
    expect(elapsed).toBeLessThan(2000);
  });

  it('rejects nested-quantifier and alternation-quantifier patterns', async () => {
    const dangerous = ['^(a+)*$', '(a|aa)+', '(.*)*', 'a{1,5}+'];
    for (const trigger of dangerous) {
      dbMock.getEnabledAutoReplies.mockResolvedValue([
        {
          id: `redos-${trigger.length}`,
          trigger,
          matchType: 'REGEX',
          specificNumber: null,
          response: 'nope',
          enabled: true,
          priority: 1,
          cooldown: 5,
        },
      ]);
      await processAutoReplies(client, makeMsg('917000000002@s.whatsapp.net', 'a'.repeat(100)));
      expect(client.sent.length).toBe(0);
      vi.clearAllMocks();
    }
  });
});
