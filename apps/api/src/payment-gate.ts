import type { FastifyReply } from 'fastify';
import { db } from '@private-md-bot/database';

export interface GateUser {
  id?: string;
  username?: string;
  email?: string;
  role?: string;
}

export type PaymentStatusResolver = (identifier: string) => Promise<{ isApproved: boolean }>;

/**
 * Authoritative WhatsApp-connect authorization gate.
 *
 * Server/database-only decision — the client, request body, query string and
 * headers can NEVER assert payment status. OWNER/ADMIN are exempt by role (role
 * is loaded from the database in `fastify.authenticate`, never from the token).
 * Every other user must resolve an APPROVED payment record from the database.
 *
 * FAIL CLOSED: missing identity, missing payment record, or any lookup error
 * all deny access.
 */
export async function canConnectWhatsApp(
  user: GateUser | null | undefined,
  resolveStatus: PaymentStatusResolver = (identifier) => db.getUserPaymentStatus(identifier)
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'OWNER' || user.role === 'ADMIN') return true;
  const identifier = user.email || user.username || user.id || '';
  if (!identifier) return false;
  try {
    const status = await resolveStatus(identifier);
    return status?.isApproved === true;
  } catch {
    return false;
  }
}

/**
 * Route helper: sends 403 with a safe message and returns false when the user
 * is not permitted. Callers MUST `return` immediately when it returns false.
 */
export async function assertCanConnectWhatsApp(
  user: GateUser | null | undefined,
  reply: FastifyReply,
  resolveStatus?: PaymentStatusResolver
): Promise<boolean> {
  if (await canConnectWhatsApp(user, resolveStatus)) return true;
  reply.code(403).send({ error: 'WhatsApp connection requires an approved payment plan' });
  return false;
}
