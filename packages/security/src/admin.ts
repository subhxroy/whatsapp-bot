import { getEnv } from '@private-md-bot/config';

export interface AuthUser {
  role?: string;
  email?: string;
  username?: string;
  id?: string;
}

/**
 * Server-side admin authorization check. Call AFTER authentication, which must
 * have reloaded the user from the database (role is authoritative, not the token).
 *
 * SECURITY CONTRACT:
 *  - Missing/invalid user => false (never grant admin).
 *  - Database role ADMIN/OWNER => admin. This is the primary, authoritative path.
 *  - Otherwise an explicit ADMIN_EMAILS allowlist (comma-separated verified
 *    emails) may grant admin. There are NO hardcoded email backdoors.
 *  - Empty allowlist => role-based only.
 *
 * @param adminEmailsOverride optional allowlist override (used by tests)
 */
export function isAdminUser(user: AuthUser | null | undefined, adminEmailsOverride?: string): boolean {
  if (!user) return false;

  if (user.role === 'ADMIN' || user.role === 'OWNER') return true;

  const adminEmails = adminEmailsOverride !== undefined ? adminEmailsOverride : getEnv().ADMIN_EMAILS || '';
  if (!adminEmails.trim()) return false;

  const identifier = String(user.email || user.username || '').toLowerCase().trim();
  if (!identifier) return false;

  return adminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(identifier);
}
