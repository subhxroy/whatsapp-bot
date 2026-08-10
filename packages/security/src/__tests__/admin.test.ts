import { describe, it, expect } from 'vitest';
import { isAdminUser } from '../admin';

describe('isAdminUser — no hardcoded admin backdoors', () => {
  it('rejects missing/invalid users', () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
    expect(isAdminUser({})).toBe(false);
  });

  it('grants admin based on database role', () => {
    expect(isAdminUser({ role: 'ADMIN', username: 'anyone@example.com' }, '')).toBe(true);
    expect(isAdminUser({ role: 'OWNER', username: 'owner@example.com' }, '')).toBe(true);
  });

  it('does NOT grant admin to plain users without an allowlist', () => {
    expect(isAdminUser({ role: 'USER', username: 'contact.subhroy@gmail.com' }, '')).toBe(false);
    expect(isAdminUser({ role: 'USER', username: 'admin' }, '')).toBe(false);
    expect(isAdminUser({ role: 'USER', username: 'admin@openify.studio' }, '')).toBe(false);
  });

  it('grants admin via explicit ADMIN_EMAILS allowlist only', () => {
    expect(isAdminUser({ role: 'USER', username: 'boss@example.com' }, 'boss@example.com')).toBe(true);
    expect(isAdminUser({ role: 'USER', username: 'boss@example.com' }, 'a@x.com, boss@example.com')).toBe(true);
  });

  it('does NOT grant admin to emails missing from the allowlist', () => {
    expect(isAdminUser({ role: 'USER', username: 'stranger@example.com' }, 'boss@example.com')).toBe(false);
    expect(isAdminUser({ role: 'USER', username: 'admin@openify.studio' }, 'boss@example.com')).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(isAdminUser({ role: 'USER', username: 'Boss@Example.com' }, 'boss@example.com')).toBe(true);
  });
});
