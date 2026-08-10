import type { ScheduleStatus } from './index';

export type DeletedMessageRetention = '24h' | '7d' | '30d' | '90d' | 'forever';
export type ContentRetention = 'metadata' | '7d' | '30d' | '90d';

const RETENTION_MS: Record<Exclude<DeletedMessageRetention, 'forever'>, number> = {
  '24h': 24 * 3600 * 1000,
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
  '90d': 90 * 24 * 3600 * 1000,
};

const CONTENT_RETENTION_MS: Record<Exclude<ContentRetention, 'metadata'>, number> = {
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
  '90d': 90 * 24 * 3600 * 1000,
};

/** Milliseconds to retain deleted-message records; null = keep forever. */
export function deletedMessageRetentionMs(retention: DeletedMessageRetention): number | null {
  if (retention === 'forever') return null;
  return RETENTION_MS[retention];
}

/** ISO `retainedUntil` for a deletion event given a retention policy. */
export function retainedUntilIso(retention: DeletedMessageRetention, now: Date = new Date()): string {
  const ms = deletedMessageRetentionMs(retention);
  if (ms === null) return '9999-12-31T23:59:59.999Z';
  return new Date(now.getTime() + ms).toISOString();
}

/** Whether message BODIES may be persisted for the given content-retention policy. */
export function contentBodyAllowed(retention: ContentRetention): boolean {
  return retention !== 'metadata';
}

/** Milliseconds for which message-history bodies are kept; null = metadata-only. */
export function contentRetentionMs(retention: ContentRetention): number | null {
  if (retention === 'metadata') return null;
  return CONTENT_RETENTION_MS[retention];
}

export const EDITABLE_STATUSES: ScheduleStatus[] = ['PENDING', 'DRAFT', 'PAUSED', 'FAILED'];
export const DELIVERABLE_STATUSES: ScheduleStatus[] = ['PENDING'];

export function isScheduleEditable(status: ScheduleStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function isScheduleDeliverable(status: ScheduleStatus): boolean {
  return DELIVERABLE_STATUSES.includes(status);
}

/** Allowed single-step transitions for user-initiated lifecycle actions. */
export const USER_TRANSITIONS: Partial<Record<ScheduleStatus, ScheduleStatus[]>> = {
  PENDING: ['PAUSED', 'CANCELLED'],
  DRAFT: ['PENDING', 'CANCELLED'],
  PAUSED: ['PENDING', 'CANCELLED'],
  FAILED: ['PENDING', 'CANCELLED'],
  CANCELLED: [],
  SENT: [],
  PROCESSING: [],
};

export function canTransition(from: ScheduleStatus, to: ScheduleStatus): boolean {
  return (USER_TRANSITIONS[from] || []).includes(to);
}

/** Normalize a phone-number string into pure E.164-ish digits. */
export function cleanPhoneNumber(input: string): string {
  return input.replace(/[^\d]/g, '');
}

export function isValidPhoneNumber(input: string): boolean {
  const digits = cleanPhoneNumber(input);
  return digits.length >= 7 && digits.length <= 15;
}

export interface ScheduleQuery {
  search?: string;
  status?: string;
  type?: 'BIRTHDAY' | 'SCHEDULED';
  sort?: 'scheduledAt' | 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/** Clamp + normalize pagination parameters. */
export function normalizePagination(page?: number, pageSize?: number, max = 100): { page: number; pageSize: number } {
  const p = Math.max(1, Math.floor(page || 1));
  const s = Math.min(max, Math.max(1, Math.floor(pageSize || 25)));
  return { page: p, pageSize: s };
}

export interface ScheduleOwnerRecord {
  userId?: string | null;
  senderJid?: string | null;
}

/**
 * Exact-match ownership check for schedule records.
 * SECURITY: never prefix/substring matches. A userId that is a digit-prefix of
 * another user's sender JID (e.g. "91" vs "919876543210@s.whatsapp.net") must
 * NOT grant read access to that user's records. Mirrors the digits-normalized
 * exact comparison used by SessionManager.getClientForMessage.
 */
export function scheduleVisibleToUser(record: ScheduleOwnerRecord, userId?: string): boolean {
  if (!userId) return true;
  if (record.userId === userId) return true;
  const userPhone = String(userId).replace(/\D/g, '');
  if (userPhone.length === 0) return false;
  const senderPhone = record.senderJid?.split('@')[0]?.split(':')[0]?.replace(/\D/g, '') || '';
  return senderPhone === userPhone;
}
