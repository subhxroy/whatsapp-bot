import { describe, it, expect } from 'vitest';
import { isOwner, hasPermission, isAuthorizedOwner, normalizePhoneNumber } from '../permissions';

describe('Permissions Module (RBAC & Owner checks)', () => {
  const configuredOwnerNumber = '1234567890';

  it('should identify owner based on configured phone digits', () => {
    expect(isOwner('1234567890@s.whatsapp.net', configuredOwnerNumber)).toBe(true);
    expect(isOwner('9999999999@s.whatsapp.net', configuredOwnerNumber)).toBe(false);
  });

  it('should enforce role hierarchy correctly', () => {
    expect(hasPermission('OWNER', 'ADMIN')).toBe(true);
    expect(hasPermission('ADMIN', 'OWNER')).toBe(false);
    expect(hasPermission('PUBLIC', 'OWNER')).toBe(false);
    expect(hasPermission('PUBLIC', 'PUBLIC')).toBe(true);
  });
});

describe('Security: phone normalization', () => {
  it('should normalize +91 98641 49429 to 919864149429', () => {
    expect(normalizePhoneNumber('+91 98641 49429')).toBe('919864149429');
  });

  it('should normalize +919864149429 to 919864149429', () => {
    expect(normalizePhoneNumber('+919864149429')).toBe('919864149429');
  });

  it('should normalize 91-98641-49429 to 919864149429', () => {
    expect(normalizePhoneNumber('91-98641-49429')).toBe('919864149429');
  });

  it('should strip JID and device suffixes', () => {
    expect(normalizePhoneNumber('916000619381@s.whatsapp.net')).toBe('916000619381');
    expect(normalizePhoneNumber('916000619381:11@s.whatsapp.net')).toBe('916000619381');
    expect(normalizePhoneNumber('916000619381:0@s.whatsapp.net')).toBe('916000619381');
  });

  it('should normalize parenthesized numbers', () => {
    expect(normalizePhoneNumber('+91 (98641) 49429')).toBe('919864149429');
  });

  it('should return empty string for missing input', () => {
    expect(normalizePhoneNumber('')).toBe('');
    expect(normalizePhoneNumber(undefined as any)).toBe('');
    expect(normalizePhoneNumber(null as any)).toBe('');
  });
});

describe('Security: fail-closed owner authorization', () => {
  const owner = '919864149429';

  it('ALLOW: owner number matches sender phone', () => {
    expect(isAuthorizedOwner('919864149429@s.whatsapp.net', owner)).toBe(true);
  });

  it('ALLOW: owner configured with +91 / spaces', () => {
    expect(isAuthorizedOwner('919864149429', '+91 98641 49429')).toBe(true);
  });

  it('DENY: different phone number', () => {
    expect(isAuthorizedOwner('916000619381@s.whatsapp.net', owner)).toBe(false);
  });

  it('DENY: missing owner configuration (fail closed)', () => {
    expect(isAuthorizedOwner('919864149429@s.whatsapp.net', '')).toBe(false);
    expect(isAuthorizedOwner('919864149429@s.whatsapp.net', undefined as any)).toBe(false);
    expect(isAuthorizedOwner('919864149429@s.whatsapp.net', null as any)).toBe(false);
  });

  it('DENY: missing sender identity (fail closed)', () => {
    expect(isAuthorizedOwner('', owner)).toBe(false);
    expect(isAuthorizedOwner(undefined as any, owner)).toBe(false);
    expect(isAuthorizedOwner(null as any, owner)).toBe(false);
  });

  it('DENY: LID identity is never authorized as a phone number', () => {
    expect(isAuthorizedOwner('176230491829124@lid', owner)).toBe(false);
    // even if LID digits coincidentally match, a LID is not a phone identity
    expect(isAuthorizedOwner('919864149429@lid', owner)).toBe(false);
  });

  it('DENY: no fuzzy / contains / starts-with matching', () => {
    expect(isAuthorizedOwner('91986414942999@s.whatsapp.net', owner)).toBe(false);
    expect(isAuthorizedOwner('19919864149429@s.whatsapp.net', owner)).toBe(false);
    expect(isAuthorizedOwner('91986414@s.whatsapp.net', owner)).toBe(false);
  });

  it('ALLOW: fromMe (bot own linked account) is trusted', () => {
    expect(isAuthorizedOwner('', owner, true)).toBe(true);
  });

  it('DENY: empty owner with fromMe=false stays denied', () => {
    expect(isAuthorizedOwner('919864149429', '', false)).toBe(false);
  });
});
