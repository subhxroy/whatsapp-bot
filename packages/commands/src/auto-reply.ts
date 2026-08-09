import { NormalizedMessage, WhatsAppClient } from '@private-md-bot/whatsapp';
import { db } from '@private-md-bot/database';
import { RateLimiter } from '@private-md-bot/security';

const autoReplyRateLimiter = new RateLimiter(10000, 1); // 1 reply per 10 seconds per rule per sender

export async function processAutoReplies(client: WhatsAppClient, msg: NormalizedMessage): Promise<boolean> {
  // Loop prevention: Never reply to bot's own messages
  if (msg.fromMe || !msg.body) return false;

  const text = msg.body.trim();
  const rules = await db.getEnabledAutoReplies();

  for (const rule of rules) {
    // Specific phone number filter check
    if (rule.specificNumber && rule.specificNumber.trim()) {
      const cleanTarget = rule.specificNumber.replace(/\D/g, '');
      const senderDigits = (msg.senderJid || '').replace(/\D/g, '');
      if (cleanTarget && !senderDigits.endsWith(cleanTarget) && senderDigits !== cleanTarget) {
        continue;
      }
    }

    let matches = false;
    const trigger = rule.trigger.trim();

    switch (rule.matchType) {
      case 'EXACT':
        matches = text.toLowerCase() === trigger.toLowerCase();
        break;
      case 'CONTAINS':
        matches = text.toLowerCase().includes(trigger.toLowerCase());
        break;
      case 'STARTS_WITH':
        matches = text.toLowerCase().startsWith(trigger.toLowerCase());
        break;
      case 'ENDS_WITH':
        matches = text.toLowerCase().endsWith(trigger.toLowerCase());
        break;
      case 'REGEX':
        try {
          const rx = new RegExp(trigger, 'i');
          matches = rx.test(text);
        } catch {
          matches = false;
        }
        break;
      case 'ANY':
        matches = true;
        break;
    }

    if (matches) {
      const rateKey = `autoreply_${rule.id}_${msg.senderJid}`;
      if (autoReplyRateLimiter.isRateLimited(rateKey)) {
        return false;
      }

      await client.sendMessage(msg.chatId, rule.response);
      return true;
    }
  }

  return false;
}
