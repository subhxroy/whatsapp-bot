import { SessionManager } from './session-manager';
import { db } from '@private-md-bot/database';

export function startMessageScheduler(sessionManager: SessionManager) {
  console.log('⏰ Background Message & Birthday Scheduler started');

  setInterval(async () => {
    try {
      const pending = await db.getPendingScheduledMessages();
      if (!pending || pending.length === 0) return;

      const now = new Date();

      for (const item of pending) {
        const scheduledTime = new Date(item.scheduledAt);
        if (scheduledTime > now) continue;

        // Find the sender's session
        const senderEmail = item.senderJid?.split('@')[0] || '';
        const client = sessionManager.get(senderEmail) || sessionManager.getClientForMessage(item.senderJid);

        if (!client || client.getStatus() !== 'CONNECTED') {
          console.log(`[Scheduler] No connected session for sender ${senderEmail}, skipping ${item.id}`);
          continue;
        }

        try {
          console.log(`[Scheduler] Delivering ${item.type} to ${item.targetNumber}...`);
          await client.sendMessage(item.targetJid, item.message);
          await db.markScheduledMessageSent(item.id);

          if (item.senderJid && item.senderJid.includes('@s.whatsapp.net')) {
            try {
              await client.sendMessage(
                item.senderJid,
                `🎉 *Delivered ${item.type === 'BIRTHDAY' ? 'Birthday Wish' : 'Scheduled Message'}!*\n• *To:* ${item.targetNumber}\n• *Message:* ${item.message}`
              );
            } catch {}
          }
        } catch (err: any) {
          console.error(`[Scheduler] Error delivering scheduled message ${item.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Poll error:', err);
    }
  }, 5000);
}
