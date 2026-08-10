import { SessionManager } from './session-manager';
import { db } from '@private-md-bot/database';
import { getEnv } from '@private-md-bot/config';

const POLL_INTERVAL_MS = 5000;
const STALE_PROCESSING_MS = 2 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export function startMessageScheduler(sessionManager: SessionManager) {
  console.log('⏰ Background Message & Birthday Scheduler started');

  const deliverDue = async () => {
    const due = await db.getDueScheduledMessages();
    if (!due || due.length === 0) return;

    for (const item of due) {
      // Atomic claim: PENDING/SCHEDULED -> PROCESSING. Overlapping ticks, restarts,
      // and multi-instance runs can never double-claim the same record.
      const claimed = await db.claimScheduledMessage(item.id);
      if (!claimed) continue;

      const userId = claimed.userId || '';
      const client =
        (userId ? sessionManager.get(userId) : undefined) ||
        (claimed.senderJid ? sessionManager.getClientForMessage(claimed.senderJid) : undefined);

      if (!client || client.getStatus() !== 'CONNECTED') {
        // Session unavailable — put back in the deliverable pool for the next tick.
        await db.transitionScheduledMessage(claimed.id, ['PROCESSING'], 'PENDING');
        continue;
      }

      try {
        console.log(`[Scheduler] Delivering ${claimed.type} to ${claimed.targetNumber}...`);
        await db.createMessageEvent({
          scheduleId: claimed.id,
          userId: claimed.userId ?? null,
          eventType: 'DELIVERY_ATTEMPT',
          status: 'PROCESSING',
          attempt: claimed.deliveryAttempts || 1,
          targetNumber: claimed.targetNumber,
        });
        const result = await client.sendMessage(claimed.targetJid, claimed.message);
        const sentMessageId = (result as any)?.key?.id;
        await db.markScheduledMessageSent(claimed.id, sentMessageId);
        await db.createMessageEvent({
          scheduleId: claimed.id,
          userId: claimed.userId ?? null,
          eventType: 'DELIVERY_SENT',
          status: 'SENT',
          attempt: claimed.deliveryAttempts || 1,
          messageId: sentMessageId,
          targetNumber: claimed.targetNumber,
        });

        if (claimed.senderJid && claimed.senderJid.includes('@s.whatsapp.net')) {
          try {
            await client.sendMessage(
              claimed.senderJid,
              `🎉 *Delivered ${claimed.type === 'BIRTHDAY' ? 'Birthday Wish' : 'Scheduled Message'}!*\n• *To:* ${claimed.targetNumber}\n• *Message:* ${claimed.message}`
            );
          } catch {}
        }
      } catch (err: any) {
        const message = err?.message || 'Unknown delivery error';
        console.error(`[Scheduler] Error delivering scheduled message ${claimed.id}:`, err);
        await db.markScheduledMessageFailed(claimed.id, message);
        await db.createMessageEvent({
          scheduleId: claimed.id,
          userId: claimed.userId ?? null,
          eventType: 'DELIVERY_FAILED',
          status: 'FAILED',
          attempt: claimed.deliveryAttempts || 1,
          errorCode: (err as any)?.code || undefined,
          errorMessage: message,
          targetNumber: claimed.targetNumber,
        });
      }
    }
  };

  const cleanup = async () => {
    try {
      const env = getEnv();
      const requeued = await db.requeueStaleProcessing(STALE_PROCESSING_MS);
      if (requeued > 0) console.log(`[Scheduler] Requeued ${requeued} stale PROCESSING records`);
      if (env.DELETED_MESSAGE_RETENTION !== 'forever') {
        const expired = await db.deleteExpiredDeletedMessages();
        if (expired > 0) console.log(`[Scheduler] Purged ${expired} expired deleted-message records`);
      }
    } catch (err) {
      console.error('[Scheduler] Cleanup error:', err);
    }
  };

  const tick = async () => {
    try {
      await deliverDue();
    } catch (err) {
      console.error('[Scheduler] Poll error:', err);
    }
  };

  setInterval(tick, POLL_INTERVAL_MS);
  setInterval(cleanup, CLEANUP_INTERVAL_MS);
  cleanup();
}
