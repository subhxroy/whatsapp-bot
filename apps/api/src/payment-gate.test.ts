import { describe, expect, it } from 'vitest';
import { canConnectWhatsApp, assertCanConnectWhatsApp, GateUser } from './payment-gate';

function makeReply() {
  const state: { sent: { code: number; body: unknown } | null } = { sent: null };
  return {
    reply: {
      code(c: number) {
        return {
          send(body: unknown) {
            state.sent = { code: c, body };
          },
        };
      },
    } as any,
    get sent() {
      return state.sent;
    },
  };
}

describe('canConnectWhatsApp', () => {
  const resolveApproved = async () => ({ isApproved: true });
  const resolveDenied = async () => ({ isApproved: false });
  const resolveThrows = async (): Promise<{ isApproved: boolean }> => {
    throw new Error('firestore down');
  };

  it('denies when user is missing', async () => {
    expect(await canConnectWhatsApp(null, resolveApproved)).toBe(false);
    expect(await canConnectWhatsApp(undefined, resolveApproved)).toBe(false);
  });

  it('denies unpaid users', async () => {
    expect(await canConnectWhatsApp({ id: 'u1', username: 'u1' }, resolveDenied)).toBe(false);
  });

  it('denies when payment lookup errors (fail closed)', async () => {
    expect(await canConnectWhatsApp({ id: 'u1', username: 'u1' }, resolveThrows)).toBe(false);
  });

  it('allows approved users', async () => {
    expect(await canConnectWhatsApp({ id: 'u1', username: 'u1' }, resolveApproved)).toBe(true);
  });

  it('allows owner and admin regardless of payment records', async () => {
    expect(await canConnectWhatsApp({ id: 'o1', username: 'o1', role: 'OWNER' }, resolveDenied)).toBe(true);
    expect(await canConnectWhatsApp({ id: 'a1', username: 'a1', role: 'ADMIN' }, resolveThrows)).toBe(true);
  });

  it('denies when no identity can be resolved', async () => {
    expect(await canConnectWhatsApp({}, resolveApproved)).toBe(false);
  });

  it('uses email/username before id as payment identifier', async () => {
    let usedIdentifier = '';
    const capture: any = async (identifier: string) => {
      usedIdentifier = identifier;
      return { isApproved: true };
    };
    await canConnectWhatsApp({ id: 'uid-abc', username: 'alice', email: 'alice' }, capture);
    expect(usedIdentifier).toBe('alice');
  });
});

describe('assertCanConnectWhatsApp', () => {
  it('sends 403 with safe message and returns false when denied', async () => {
    const harness = makeReply();
    const allowed = await assertCanConnectWhatsApp({ id: 'u1', username: 'u1' }, harness.reply, async () => ({
      isApproved: false,
    }));
    expect(allowed).toBe(false);
    expect(harness.sent?.code).toBe(403);
    expect(JSON.stringify(harness.sent?.body)).not.toContain('firestore');
    expect(JSON.stringify(harness.sent?.body)).toContain('payment');
  });

  it('returns true without sending when allowed', async () => {
    const harness = makeReply();
    const allowed = await assertCanConnectWhatsApp({ id: 'u1', username: 'u1' }, harness.reply, async () => ({
      isApproved: true,
    }));
    expect(allowed).toBe(true);
    expect(harness.sent).toBeNull();
  });
});
