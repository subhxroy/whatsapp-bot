import { WhatsAppClient } from '@private-md-bot/whatsapp';
import { db } from '@private-md-bot/database';

export function startMessageScheduler(waClient: WhatsAppClient) {
  console.log('⏰ Background Message & Birthday Scheduler started');

  setInterval(async () => {
    try {
      if (waClient.getStatus() !== 'CONNECTED') return;

      const pending = await db.getPendingScheduledMessages();
      if (!pending || pending.length === 0) return;

      const now = new Date();

      for (const item of pending) {
        const scheduledTime = new Date(item.scheduledAt);
        if (scheduledTime <= now) {
          try {
            console.log(`[Scheduler] Delivering ${item.type} to ${item.targetNumber}...`);
            await waClient.sendMessage(item.targetJid, item.message);
            await db.markScheduledMessageSent(item.id);

            // Notify the sender in self-chat
            if (item.senderJid) {
              await waClient.sendMessage(
                item.senderJid,
                `🎉 *Delivered ${item.type === 'BIRTHDAY' ? 'Birthday Wish' : 'Scheduled Message'}!*\n• *To:* ${item.targetNumber}\n• *Message:* ${item.message}`
              );
            }
          } catch (err: any) {
            console.error(`[Scheduler] Error delivering scheduled message ${item.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler] Poll error:', err);
    }
  }, 15000); // Check every 15 seconds
}
