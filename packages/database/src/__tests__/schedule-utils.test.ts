import { describe, it, expect } from 'vitest';
import {
  deletedMessageRetentionMs,
  retainedUntilIso,
  contentBodyAllowed,
  contentRetentionMs,
  isScheduleEditable,
  isScheduleDeliverable,
  canTransition,
  cleanPhoneNumber,
  isValidPhoneNumber,
  normalizePagination,
  scheduleVisibleToUser,
  USER_TRANSITIONS,
} from '../schedule-utils';

describe('retention windows', () => {
  it('maps deleted-message retention to millis and forever to null', () => {
    expect(deletedMessageRetentionMs('24h')).toBe(24 * 3600 * 1000);
    expect(deletedMessageRetentionMs('7d')).toBe(7 * 24 * 3600 * 1000);
    expect(deletedMessageRetentionMs('forever')).toBeNull();
  });

  it('computes retainedUntil ISO from now + retention', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(retainedUntilIso('24h', now)).toBe('2026-01-02T00:00:00.000Z');
    expect(retainedUntilIso('7d', now)).toBe('2026-01-08T00:00:00.000Z');
    expect(retainedUntilIso('forever', now)).toBe('9999-12-31T23:59:59.999Z');
  });

  it('never persists bodies under metadata-only retention', () => {
    expect(contentBodyAllowed('metadata')).toBe(false);
    expect(contentBodyAllowed('7d')).toBe(true);
    expect(contentBodyAllowed('90d')).toBe(true);
    expect(contentRetentionMs('metadata')).toBeNull();
    expect(contentRetentionMs('30d')).toBe(30 * 24 * 3600 * 1000);
  });
});

describe('schedule lifecycle rules', () => {
  it('allows editing only pending/draft/paused/failed schedules', () => {
    for (const s of ['PENDING', 'DRAFT', 'PAUSED', 'FAILED'] as const) {
      expect(isScheduleEditable(s)).toBe(true);
    }
    for (const s of ['SENT', 'CANCELLED', 'PROCESSING'] as const) {
      expect(isScheduleEditable(s)).toBe(false);
    }
  });

  it('only pending schedules are deliverable', () => {
    expect(isScheduleDeliverable('PENDING')).toBe(true);
    expect(isScheduleDeliverable('PAUSED')).toBe(false);
    expect(isScheduleDeliverable('SENT')).toBe(false);
  });

  it('guards user lifecycle transitions', () => {
    expect(canTransition('PENDING', 'PAUSED')).toBe(true);
    expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(canTransition('PAUSED', 'PENDING')).toBe(true);
    expect(canTransition('FAILED', 'PENDING')).toBe(true);
    expect(canTransition('DRAFT', 'PENDING')).toBe(true);
    expect(canTransition('SENT', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'PENDING')).toBe(false);
    expect(canTransition('PROCESSING', 'CANCELLED')).toBe(false);
  });

  it('exposes a closed transition map (no unexpected statuses)', () => {
    const keys = Object.keys(USER_TRANSITIONS).sort();
    expect(keys).toEqual(['CANCELLED', 'DRAFT', 'FAILED', 'PAUSED', 'PENDING', 'PROCESSING', 'SENT']);
  });
});

describe('phone-number validation', () => {
  it('strips non-digits and validates E.164-ish ranges', () => {
    expect(cleanPhoneNumber('+1 (555) 123-4567')).toBe('15551234567');
    expect(cleanPhoneNumber('  abc 911  ')).toBe('911');
    expect(isValidPhoneNumber('+91 9876543210')).toBe(true);
    expect(isValidPhoneNumber('123456')).toBe(false); // too short
    expect(isValidPhoneNumber('1234567890123456')).toBe(false); // too long
    expect(isValidPhoneNumber('')).toBe(false);
  });
});

describe('pagination normalization', () => {
  it('clamps page/pageSize to safe bounds', () => {
    expect(normalizePagination()).toEqual({ page: 1, pageSize: 25 });
    expect(normalizePagination(0, 0)).toEqual({ page: 1, pageSize: 25 }); // 0 → default
    expect(normalizePagination(-3, -10)).toEqual({ page: 1, pageSize: 1 });
    expect(normalizePagination(2, 500)).toEqual({ page: 2, pageSize: 100 });
    expect(normalizePagination(1.9, 12.7)).toEqual({ page: 1, pageSize: 12 });
  });
});

describe('schedule ownership visibility (multi-tenant isolation)', () => {
  it('exact userId match is visible', () => {
    expect(scheduleVisibleToUser({ userId: 'userA', senderJid: 'userA@s.whatsapp.net' }, 'userA')).toBe(true);
  });

  it('digits-normalized sender JID matches own phone-based id', () => {
    expect(
      scheduleVisibleToUser({ userId: 'userB', senderJid: '919876543210@s.whatsapp.net' }, '919876543210')
    ).toBe(true);
  });

  it('prefix of another user phone never grants visibility (cross-tenant leak guard)', () => {
    // userId "91" is a digit-prefix of victim sender JID "919876543210@..."
    expect(scheduleVisibleToUser({ userId: 'userB', senderJid: '919876543210@s.whatsapp.net' }, '91')).toBe(false);
    // userId "9198" is a longer prefix — still not visible
    expect(scheduleVisibleToUser({ userId: 'userB', senderJid: '919876543210@s.whatsapp.net' }, '9198')).toBe(false);
  });

  it('different owner is never visible; empty/whitespace ids do not leak', () => {
    expect(scheduleVisibleToUser({ userId: 'userA', senderJid: 'userA@s.whatsapp.net' }, 'userC')).toBe(false);
    // whitespace-only id passes the truthy gate but carries no phone digits → denied
    expect(scheduleVisibleToUser({ userId: 'userA', senderJid: 'userA@s.whatsapp.net' }, '   ')).toBe(false);
  });

  it('empty userId (caller skips the filter) is unrestricted', () => {
    expect(scheduleVisibleToUser({ userId: 'userA', senderJid: 'userA@s.whatsapp.net' }, '')).toBe(true);
  });

  it('no userId provided (admin/bulk path) is unrestricted', () => {
    expect(scheduleVisibleToUser({ userId: 'userA', senderJid: 'userA@s.whatsapp.net' })).toBe(true);
  });
});
