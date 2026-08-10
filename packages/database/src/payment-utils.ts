export interface DatedPaymentRecord {
  createdAt?: unknown;
  status: string;
}

/**
 * Returns the payment request with the most recent `createdAt`, or undefined
 * when empty. SECURITY: this makes approve-then-revoke deterministic — the
 * latest decision always wins, so a stale APPROVED cannot override a later
 * REJECTED. Records without a createdAt sort last.
 */
export function mostRecentPaymentRequest<T extends DatedPaymentRecord>(docs: readonly T[]): T | undefined {
  if (docs.length === 0) return undefined;
  return [...docs].sort((a, b) => {
    const ta = String(a.createdAt || '');
    const tb = String(b.createdAt || '');
    return tb.localeCompare(ta);
  })[0];
}
