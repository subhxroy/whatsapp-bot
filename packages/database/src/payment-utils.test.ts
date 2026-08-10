import { describe, expect, it } from 'vitest';
import { mostRecentPaymentRequest } from './payment-utils';

describe('mostRecentPaymentRequest', () => {
  it('returns undefined for empty input', () => {
    expect(mostRecentPaymentRequest([])).toBeUndefined();
  });

  it('returns the only record', () => {
    const record = { createdAt: '2026-01-01T00:00:00.000Z', status: 'APPROVED' };
    expect(mostRecentPaymentRequest([record])).toBe(record);
  });

  it('latest decision wins (approve-then-revoke must fail closed)', () => {
    const records = [
      { createdAt: '2026-01-01T00:00:00.000Z', status: 'APPROVED' },
      { createdAt: '2026-02-01T00:00:00.000Z', status: 'REJECTED' },
    ];
    expect(mostRecentPaymentRequest(records)?.status).toBe('REJECTED');
  });

  it('latest decision wins regardless of input order', () => {
    const records = [
      { createdAt: '2026-02-01T00:00:00.000Z', status: 'REJECTED' },
      { createdAt: '2026-01-01T00:00:00.000Z', status: 'APPROVED' },
    ];
    expect(mostRecentPaymentRequest(records)?.status).toBe('REJECTED');
  });

  it('records without createdAt sort last', () => {
    const records = [
      { createdAt: '2026-01-01T00:00:00.000Z', status: 'APPROVED' },
      { status: 'REJECTED' },
    ];
    expect(mostRecentPaymentRequest(records)?.status).toBe('APPROVED');
  });
});
