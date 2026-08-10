import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NormalizedMessage } from '@private-md-bot/whatsapp';

// ---- Module mocks (must be hoisted) ---------------------------------------

const configMock = vi.hoisted(() => ({
  getEnv: () => ({ BOT_OWNER_NUMBER: '' }),
  env: { BOT_OWNER_NUMBER: '' },
}));

const dbMock = vi.hoisted(() => ({
  getSetting: vi.fn(async (key: string): Promise<any> => null),
  getCommandConfig: vi.fn(async (name: string): Promise<any> => null),
  createAuditLog: vi.fn(async (log: any) => ({})),
  createScheduledMessage: vi.fn(async () => ({ id: 'sched-1' })),
  getEnabledAutoReplies: vi.fn(async (userId?: string): Promise<any[]> => []),
  getAutoReplies: vi.fn(async () => []),
}));

vi.mock('@private-md-bot/config', () => configMock);
vi.mock('@private-md-bot/database', () => ({ db: dbMock }));

// ----------------------------------------------------------------------------

import { CommandDispatcher } from '../dispatcher';
import { registry } from '../registry';

const OWNER = '919864149429';
const ATTACKER = '916000619381';
const FRESH_TARGET = '917000000001';
const FRESH_AUDIT = '917000000002';

function makeClient() {
  const sent: Array<{ chatId: string; content: any }> = [];
  const client: any = {
    sent,
    sendMessage: vi.fn(async (chatId: string, content: any) => {
      sent.push({ chatId, content });
      return { key: { id: 'mock' } };
    }),
    sendMedia: vi.fn(async () => ({})),
    getCachedMessage: vi.fn(() => undefined),
    downloadMedia: vi.fn(async () => Buffer.from('')),
    downloadMediaFromContent: vi.fn(async () => Buffer.from('')),
    getUserId: vi.fn(() => undefined),
  };
  return client;
}

function makeMsg(over: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    id: 'msg_1',
    chatId: '919864149429@s.whatsapp.net',
    senderJid: `${OWNER}@s.whatsapp.net`,
    senderNumber: OWNER,
    senderResolved: true,
    pushName: undefined,
    fromMe: false,
    isGroup: false,
    body: '.ping',
    hasMedia: false,
    isViewOnce: false,
    rawMessage: {},
    ...over,
  };
}

function hasText(sent: Array<{ content: any }>, needle: string): boolean {
  return sent.some((s) => {
    if (typeof s.content === 'string') return s.content.includes(needle);
    if (s.content && typeof s.content === 'object') {
      return JSON.stringify(s.content).includes(needle);
    }
    return false;
  });
}

function configureOwnerInDb(value: string | null) {
  dbMock.getSetting.mockImplementation(async (key: string) => {
    if (key === 'BOT_OWNER_NUMBER') return value ? { value } : null;
    return null;
  });
}

describe('CommandDispatcher — WhatsApp command authorization (E2E)', () => {
  let client: ReturnType<typeof makeClient>;
  let dispatcher: CommandDispatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
    dispatcher = new CommandDispatcher(client as any);
    dbMock.getSetting.mockImplementation(async () => null);
    dbMock.getCommandConfig.mockImplementation(async () => null);
    dbMock.createAuditLog.mockResolvedValue({});
    dbMock.getEnabledAutoReplies.mockResolvedValue([]);
  });

  it('registry defaults: every command is owner-only (fail safe)', () => {
    const cmds = registry.getAllCommands();
    expect(cmds.length).toBeGreaterThan(0);
    for (const c of cmds) {
      expect(c.ownerOnly, `.${c.name} must default to ownerOnly`).toBe(true);
    }
  });

  it('TEST 1: Owner sends .ping -> ALLOW (Pong returned)', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(makeMsg({ body: '.ping' }));
    expect(hasText(client.sent, 'Pong')).toBe(true);
  });

  it('TEST 2: Different number sends .ping -> DENY (no Pong)', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `${ATTACKER}@s.whatsapp.net`, senderNumber: ATTACKER, body: '.ping' })
    );
    expect(hasText(client.sent, 'Pong')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('TEST 3: Different number sends .schedule -> DENY', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `${ATTACKER}@s.whatsapp.net`, senderNumber: ATTACKER, body: '.schedule 916000619381 2099-01-01 00:00 | hi' })
    );
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
    expect(hasText(client.sent, 'SUCCESSFULLY SCHEDULED')).toBe(false);
  });

  it('TEST 4: Different number sends .birthday -> DENY', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `${ATTACKER}@s.whatsapp.net`, senderNumber: ATTACKER, body: '.birthday 916000619381 2099-01-01 00:00 | hi' })
    );
    expect(hasText(client.sent, 'SUCCESSFULLY SCHEDULED')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('TEST 5: Different number sends .vv -> DENY', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `${ATTACKER}@s.whatsapp.net`, senderNumber: ATTACKER, body: '.vv' })
    );
    expect(hasText(client.sent, 'view-once')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('TEST 6: Different number sends .eval -> DENY', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `${ATTACKER}@s.whatsapp.net`, senderNumber: ATTACKER, body: '.eval 1+1' })
    );
    expect(hasText(client.sent, 'Eval Result')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('Different number sends .restart / .system -> DENY', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `${ATTACKER}@s.whatsapp.net`, senderNumber: ATTACKER, body: '.restart' })
    );
    expect(hasText(client.sent, 'Restarting')).toBe(false);
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `${ATTACKER}@s.whatsapp.net`, senderNumber: ATTACKER, body: '.system' })
    );
    expect(hasText(client.sent, 'System & Server Diagnostics')).toBe(false);
  });

  it('TEST 7: Owner arrives through @lid, LID resolves to owner PN -> ALLOW', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({
        senderJid: '176230491829124@lid',
        senderNumber: OWNER,
        senderResolved: true,
        body: '.ping',
      })
    );
    expect(hasText(client.sent, 'Pong')).toBe(true);
  });

  it('TEST 8: Attacker arrives through @lid, resolves to attacker PN -> DENY', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({
        senderJid: '999000111222@lid',
        senderNumber: ATTACKER,
        senderResolved: true,
        body: '.ping',
      })
    );
    expect(hasText(client.sent, 'Pong')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('TEST 9: Unknown LID (unresolved identity) -> DENY', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({
        senderJid: '555000111222@lid',
        senderNumber: '555000111222',
        senderResolved: false,
        body: '.ping',
      })
    );
    expect(hasText(client.sent, 'Pong')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('TEST 10: Missing owner configuration -> DENY / FAIL CLOSED', async () => {
    configureOwnerInDb(null);
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `${OWNER}@s.whatsapp.net`, senderNumber: OWNER, body: '.ping' })
    );
    expect(hasText(client.sent, 'Pong')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('TEST 11: Owner number stored with +91 -> ALLOW after normalization', async () => {
    configureOwnerInDb('+91 98641 49429');
    await dispatcher.handleMessage(makeMsg({ body: '.ping' }));
    expect(hasText(client.sent, 'Pong')).toBe(true);
  });

  it('TEST 12: Owner number stored with spaces -> ALLOW after normalization', async () => {
    configureOwnerInDb('91 98641 49429');
    await dispatcher.handleMessage(makeMsg({ body: '.ping' }));
    expect(hasText(client.sent, 'Pong')).toBe(true);
  });

  it('TEST 13: Attacker writes owner number inside command -> DENY', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `916000619382@s.whatsapp.net`, senderNumber: '916000619382', body: `.ping ${OWNER}` })
    );
    expect(hasText(client.sent, 'Pong')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('TEST 14: Attacker changes display name to owner name -> DENY', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({
        senderJid: `${ATTACKER}@s.whatsapp.net`,
        senderNumber: ATTACKER,
        pushName: 'Subhankar Roy',
        body: '.ping',
      })
    );
    expect(hasText(client.sent, 'Pong')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('TEST 15: Attacker sends quoted message originally from owner -> DENY', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({
        senderJid: `${ATTACKER}@s.whatsapp.net`,
        senderNumber: ATTACKER,
        body: '.vv',
        rawMessage: {
          message: {
            extendedTextMessage: {
              contextInfo: {
                participant: `${OWNER}@s.whatsapp.net`,
                quotedMessage: { imageMessage: {} },
                stanzaId: 'owner_msg',
              },
            },
          },
        },
      })
    );
    expect(hasText(client.sent, 'view-once')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('TEST 19: Authorized owner creates schedule -> ALLOW', async () => {
    configureOwnerInDb(OWNER);
    dbMock.getCommandConfig.mockResolvedValue(null);
    await dispatcher.handleMessage(
      makeMsg({ body: '.birthday 919876543210 2099-01-01 00:00 | Happy Birthday!' })
    );
    expect(hasText(client.sent, 'SUCCESSFULLY SCHEDULED')).toBe(true);
    expect(hasText(client.sent, 'Access Denied')).toBe(false);
  });

  it('TEST 20: Auto-reply still works for configured target contact', async () => {
    configureOwnerInDb(OWNER);
    dbMock.getEnabledAutoReplies.mockResolvedValue([
      {
        id: 'r1',
        trigger: '*',
        matchType: 'ANY',
        specificNumber: '916000619381',
        response: 'Auto hello',
        enabled: true,
        priority: 1,
        cooldown: 5,
      },
    ]);
    await dispatcher.handleMessage(
      makeMsg({
        senderJid: `${ATTACKER}@s.whatsapp.net`,
        senderNumber: ATTACKER,
        body: 'hello there',
      })
    );
    expect(hasText(client.sent, 'Auto hello')).toBe(true);
  });

  it('Auto-reply target has NO command control', async () => {
    configureOwnerInDb(OWNER);
    dbMock.getEnabledAutoReplies.mockResolvedValue([
      {
        id: 'r1',
        trigger: '*',
        matchType: 'ANY',
        specificNumber: FRESH_TARGET,
        response: 'Auto hello',
        enabled: true,
        priority: 1,
        cooldown: 5,
      },
    ]);
    // Target sends a command — must be denied, NOT auto-replied as control.
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `${FRESH_TARGET}@s.whatsapp.net`, senderNumber: FRESH_TARGET, body: '.ping' })
    );
    expect(hasText(client.sent, 'Pong')).toBe(false);
    expect(hasText(client.sent, 'Auto hello')).toBe(false);
    expect(hasText(client.sent, 'Access Denied')).toBe(true);
  });

  it('DENY is audited with COMMAND_DENIED; ALLOW audited with COMMAND_ALLOWED', async () => {
    configureOwnerInDb(OWNER);
    await dispatcher.handleMessage(
      makeMsg({ senderJid: `${FRESH_AUDIT}@s.whatsapp.net`, senderNumber: FRESH_AUDIT, body: '.ping' })
    );
    const deniedAudit = dbMock.createAuditLog.mock.calls.find((c: any) => c[0].action === 'COMMAND_DENIED');
    expect(deniedAudit).toBeTruthy();
    expect(deniedAudit![0].details).toContain('command=ping');

    vi.clearAllMocks();
    await dispatcher.handleMessage(makeMsg({ body: '.menu' }));
    const allowedAudit = dbMock.createAuditLog.mock.calls.find((c: any) => c[0].action === 'COMMAND_ALLOWED');
    expect(allowedAudit).toBeTruthy();
  });
});
