import { describe, expect, it } from 'vitest';
import { safePairCodeError, GENERIC_PAIR_CODE_ERROR } from './safe-errors';

describe('safePairCodeError', () => {
  it('never returns the raw error message', () => {
    const leaked = 'Firebase private key C:\\Users\\me\\credentials.json could not be parsed: ECONNREFUSED';
    const { statusCode, body } = safePairCodeError(new Error(leaked));
    expect(statusCode).toBe(500);
    expect(body.error).toBe(GENERIC_PAIR_CODE_ERROR);
    expect(JSON.stringify(body)).not.toContain('Firebase');
    expect(JSON.stringify(body)).not.toContain('credentials');
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('does not leak Baileys or filesystem details', () => {
    const leaked = 'Baileys store read error at /home/app/session/auth.json EACCES';
    const { body } = safePairCodeError(new Error(leaked));
    expect(JSON.stringify(body)).not.toContain('Baileys');
    expect(JSON.stringify(body)).not.toContain('/home/');
    expect(JSON.stringify(body)).not.toContain('auth.json');
  });

  it('does not leak environment variable names or tokens', () => {
    const leaked = 'Refusing to use token "gAAAAAsecret" with FIRESTORE_EMULATOR_HOST';
    const { body } = safePairCodeError(new Error(leaked));
    const json = JSON.stringify(body);
    expect(json).not.toContain('secret');
    expect(json).not.toContain('FIRESTORE');
    expect(json).not.toContain('token');
  });

  it('returns a stable generic message for any error shape', () => {
    expect(safePairCodeError('string error').body.error).toBe(GENERIC_PAIR_CODE_ERROR);
    expect(safePairCodeError({ code: 7, details: 'x' }).body.error).toBe(GENERIC_PAIR_CODE_ERROR);
    expect(safePairCodeError(undefined).body.error).toBe(GENERIC_PAIR_CODE_ERROR);
  });
});
