import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { getEnv } from '@private-md-bot/config';
import { db } from '@private-md-bot/database';

const env = getEnv();

let redisClient: Redis | null = null;

try {
  redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    retryStrategy: () => null, // Do not reconnect infinitely if Redis is offline
  });

  redisClient.on('error', () => {
    // Suppress unhandled Redis error events when running without Redis locally
  });
} catch {
  console.warn('⚠️ Redis client disabled — falling back to direct Firestore audit logging');
}

export const auditQueue = redisClient
  ? new Queue('audit-logs', { connection: redisClient })
  : null;

if (redisClient) {
  try {
    const worker = new Worker(
      'audit-logs',
      async (job) => {
        const { action, actor, details, ipAddress } = job.data;
        await db.createAuditLog({
          action,
          actor,
          details,
          ipAddress,
        });
      },
      { connection: redisClient }
    );
    worker.on('error', () => {});
  } catch {}
}

export async function logAudit(action: string, actor: string, details?: string, ipAddress?: string) {
  let logged = false;

  if (auditQueue) {
    try {
      await auditQueue.add('log', { action, actor, details, ipAddress });
      logged = true;
    } catch {
      // Redis offline or failed to add to queue
    }
  }

  if (!logged) {
    try {
      await db.createAuditLog({ action, actor, details, ipAddress });
    } catch {}
  }
}
