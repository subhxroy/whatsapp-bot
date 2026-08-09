import { NormalizedMessage, WhatsAppClient } from '@private-md-bot/whatsapp';
import { db } from '@private-md-bot/database';
import { RateLimiter } from '@private-md-bot/security';

const autoReplyRateLimiter = new RateLimiter(5000, 1); // 1 reply per 5 seconds per rule per sender

/**
 * Extract clean digit string from phone number or JID
 * Removes domain suffixes (@s.whatsapp.net, @lid, @g.us) and device IDs (:11, :0, etc.)
 */
function extractCleanPhone(input?: string | null): string {
  if (!input) return '';
  const userPart = input.split('@')[0].split(':')[0];
  return userPart.replace(/\D/g, '');
}

/**
 * Check if a rule's target phone number matches any candidate sender JID or phone string
 */
function isPhoneMatch(target: string, candidate: string): boolean {
  const t = extractCleanPhone(target);
  const s = extractCleanPhone(candidate);
  if (!t || !s) return false;
  return t === s || s.endsWith(t) || t.endsWith(s);
}

export async function processAutoReplies(client: WhatsAppClient, msg: NormalizedMessage): Promise<boolean> {
  // Loop prevention: Never reply to bot's own messages
  if (msg.fromMe || !msg.body) return false;

  const text = msg.body.trim();
  const rules = await db.getEnabledAutoReplies();

  for (const rule of rules) {
    // Specific phone number filter check
    if (rule.specificNumber && rule.specificNumber.trim()) {
      const candidates = [msg.senderNumber, msg.senderJid, msg.chatId].filter(Boolean) as string[];
      const matched = candidates.some((cand) => isPhoneMatch(rule.specificNumber!, cand));
      if (!matched) {
        console.log(`[AUTOREPLY] Rule ${rule.id} target phone filter (${rule.specificNumber}) did not match candidates: ${candidates.join(', ')}`);
        continue;
      }
    }

    let matches = false;
    const trigger = rule.trigger.trim();

    if (rule.matchType === 'ANY' || trigger === '*') {
      matches = true;
    } else {
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
      }
    }

    if (matches) {
      const cleanSender = extractCleanPhone(msg.senderJid) || extractCleanPhone(msg.chatId) || msg.chatId;
      const rateKey = `autoreply_${rule.id}_${cleanSender}`;
      if (autoReplyRateLimiter.isRateLimited(rateKey)) {
        console.log(`[AUTOREPLY] Rule ${rule.id} rate limited for sender ${cleanSender}`);
        return false;
      }

      console.log(`[AUTOREPLY] Rule ${rule.id} matched message "${text}" from ${cleanSender}. Sending auto-response.`);
      await client.sendMessage(msg.chatId, rule.response);
      return true;
    }
  }

  return false;
}
