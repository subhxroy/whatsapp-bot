import { NormalizedMessage, WhatsAppClient } from '@private-md-bot/whatsapp';
import { db } from '@private-md-bot/database';
import { RateLimiter, isSafeRegex } from '@private-md-bot/security';

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
 *
 * SECURITY: two full-length numbers (both >= 11 digits, i.e. with country codes)
 * must match exactly. Suffix matching is only allowed when at least one side is a
 * short/partial or local-format number. Without this guard, a rule targeting
 * `917000000000` would also fire for sender `1917000000000` (a different number
 * that merely ends with the target's digits).
 */
function isPhoneMatch(target: string, candidate: string): boolean {
  const t = extractCleanPhone(target);
  const s = extractCleanPhone(candidate);
  if (!t || !s) return false;
  if (t === s) return true;
  if (t.length >= 11 && s.length >= 11) return false;
  return s.endsWith(t) || t.endsWith(s);
}

export async function processAutoReplies(client: WhatsAppClient, msg: NormalizedMessage): Promise<boolean> {
  // Loop prevention: Never reply to bot's own outbound messages
  if (msg.fromMe) return false;

  const text = (msg.body || '').trim();
  const rules = await db.getEnabledAutoReplies(client.getUserId() || undefined);

  console.log(`[CALDERA_DEBUG][AUTOREPLY] enabledRules=${rules.length} senderNumber=${msg.senderNumber} senderJid=${msg.senderJid} chatId=${msg.chatId} fromMe=${msg.fromMe} bodyLen=${text.length}`);

  if (rules.length === 0) return false;

  for (const rule of rules) {
    const candidates = [msg.senderNumber, msg.senderJid, msg.chatId].filter(Boolean) as string[];
    let phoneMatch = true;
    if (rule.specificNumber && rule.specificNumber.trim()) {
      phoneMatch = candidates.some((cand) => isPhoneMatch(rule.specificNumber!, cand));
    }

    let triggerMatch = false;
    const trigger = rule.trigger.trim();
    if (rule.matchType === 'ANY' || trigger === '*') {
      triggerMatch = true;
    } else if (text) {
      switch (rule.matchType) {
        case 'EXACT':
          triggerMatch = text.toLowerCase() === trigger.toLowerCase();
          break;
        case 'CONTAINS':
          triggerMatch = text.toLowerCase().includes(trigger.toLowerCase());
          break;
        case 'STARTS_WITH':
          triggerMatch = text.toLowerCase().startsWith(trigger.toLowerCase());
          break;
        case 'ENDS_WITH':
          triggerMatch = text.toLowerCase().endsWith(trigger.toLowerCase());
          break;
        case 'REGEX':
          try {
            // 🔒 SECURITY: ReDoS protection — only patterns that pass the static
            // safety guard are compiled. Input text is also bounded so a long
            // message cannot turn a slow pattern into a hang.
            if (!isSafeRegex(trigger)) {
              console.warn(`[AUTOREPLY] Rule ${rule.id} REGEX trigger rejected by ReDoS guard, skipping`);
              triggerMatch = false;
              break;
            }
            const rx = new RegExp(trigger, 'i');
            triggerMatch = rx.test(text.slice(0, 1000));
          } catch {
            triggerMatch = false;
          }
          break;
      }
    }

    const cleanSender = extractCleanPhone(msg.senderJid) || extractCleanPhone(msg.chatId) || msg.chatId;
    const rateKey = `autoreply_${rule.id}_${cleanSender}`;
    const rateLimited = phoneMatch && triggerMatch ? autoReplyRateLimiter.isRateLimited(rateKey) : false;

    console.log(
      `[CALDERA_DEBUG][AUTOREPLY] ruleId=${rule.id} enabled=${rule.enabled} trigger=${JSON.stringify(rule.trigger)} matchType=${rule.matchType} specificNumber=${JSON.stringify(rule.specificNumber)} senderNumber=${msg.senderNumber} phoneMatch=${phoneMatch} triggerMatch=${triggerMatch} rateLimit=${rateLimited}`
    );

    if (!phoneMatch || !triggerMatch) {
      if (!phoneMatch) {
        console.log(`[AUTOREPLY] Rule ${rule.id} target phone filter (${rule.specificNumber}) did not match candidates: ${candidates.join(', ')}`);
      }
      continue;
    }
    if (rateLimited) {
      console.log(`[AUTOREPLY] Rule ${rule.id} rate limited for sender ${cleanSender}`);
      return false;
    }

    console.log(
      `[CALDERA_DEBUG][SEND] chatId=${msg.chatId} senderJid=${msg.senderJid} senderNumber=${msg.senderNumber} replyLength=${(rule.response || '').length}`
    );
    console.log(`[AUTOREPLY] Rule ${rule.id} matched incoming message from ${cleanSender} (chatId: ${msg.chatId}). Sending auto-response: "${rule.response}"`);
    await client.sendMessage(msg.chatId, rule.response);
    return true;
  }

  console.log(`[CALDERA_DEBUG][AUTOREPLY] no rule matched`);
  return false;
}
