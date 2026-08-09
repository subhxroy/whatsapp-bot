import { db } from '@private-md-bot/database';

// Safe audit logging with direct DB fallback when Redis is offline/not running locally
export async function logAudit(action: string, actor: string, details?: string, ipAddress?: string) {
  try {
    await db.createAuditLog({ action, actor, details, ipAddress });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
