import { NormalizedMessage, WhatsAppClient, unwrapMessageContent } from '@private-md-bot/whatsapp';
import { registry } from './registry';
import { processAutoReplies } from './auto-reply';
import { getEnv } from '@private-md-bot/config';
import { isAuthorizedOwner, normalizePhoneNumber, RateLimiter, Role } from '@private-md-bot/security';
import { db } from '@private-md-bot/database';

const extractViewOnceContent = (content: any): any => {
  if (!content) return null;
  const unwrapped = unwrapMessageContent(content);
  if (unwrapped) return unwrapped;
  return (
    content.viewOnceMessage?.message ||
    content.viewOnceMessageV2?.message ||
    content.viewOnceMessageV2Extension?.message ||
    content.ephemeralMessage?.message ||
    content
  );
};

const getViewOnceMediaType = (content: any): 'image' | 'video' | 'audio' | null => {
  if (content?.imageMessage) return 'image';
  if (content?.videoMessage) return 'video';
  if (content?.audioMessage) return 'audio';
  return null;
};

const commandRateLimiter = new RateLimiter(5000, 3); // 3 commands per 5s default
const deniedCommandRateLimiter = new RateLimiter(30_000, 3); // deny reply at most 3x / 30s per sender+command

/**
 * Resolve the authoritative BOT OWNER phone number.
 *
 * Source of truth priority:
 *   1. Firestore `settings/BOT_OWNER_NUMBER` (written by the dashboard)
 *   2. Env `BOT_OWNER_NUMBER` (bootstrap fallback)
 *   3. Connected client phone number (the account running the bot)
 */
async function resolveOwnerPhone(client?: WhatsAppClient): Promise<string> {
  try {
    const dbSetting = await db.getSetting('BOT_OWNER_NUMBER');
    const dbDigits = normalizePhoneNumber(dbSetting?.value);
    if (dbDigits) return dbDigits;
  } catch {
    // Firestore unavailable — fall through to env
  }
  const envPhone = normalizePhoneNumber(getEnv().BOT_OWNER_NUMBER || '');
  if (envPhone) return envPhone;

  const connected = client?.getConnectedPhone();
  if (connected) return normalizePhoneNumber(connected);

  return '';
}

export class CommandDispatcher {
  private client: WhatsAppClient;

  constructor(client: WhatsAppClient) {
    this.client = client;
  }

  private async denyCommand(msg: NormalizedMessage, commandName: string, senderDigits: string): Promise<void> {
    // Rate-limit denied attempts so an unauthorized user cannot spam commands
    // and burn server resources (replies, audit writes, Firestore).
    const key = `denied_${commandName}_${senderDigits || msg.senderJid}`;
    if (deniedCommandRateLimiter.isRateLimited(key)) {
      return; // silent drop — no reply, no audit write per spam message
    }

    try {
      await db.createAuditLog({
        action: 'COMMAND_DENIED',
        actor: senderDigits || 'unknown',
        details: `command=${commandName} denied (sender is not the configured owner)`,
      });
    } catch {
      // Audit logging must never break the deny path
    }

    try {
      await this.client.sendMessage(msg.chatId, '⛔ Access Denied: This command is restricted to the bot owner.');
    } catch {
      // Ignore reply failures on the deny path
    }
  }

  private async handleAutoVv(msg: NormalizedMessage): Promise<void> {
    const rawMsg = msg.rawMessage as any;
    if (!rawMsg?.message) {
      console.warn('[AUTO-VV] No rawMessage.message, skipping');
      return;
    }

    // Unwrap view-once envelope to get the actual inner IMessage
    const inner = extractViewOnceContent(rawMsg.message);
    if (!inner) {
      console.warn('[AUTO-VV] Could not extract inner content');
      return;
    }

    const mediaType = getViewOnceMediaType(inner);
    if (!mediaType) {
      console.warn('[AUTO-VV] No media type found in inner content, skipping');
      return;
    }

    // Resolve owner's private chat JID (phone@s.whatsapp.net)
    const ownerDigits = await resolveOwnerPhone(this.client);
    let targetChatId = ownerDigits ? `${ownerDigits}@s.whatsapp.net` : '';

    // If owner number is not yet configured and this is a 1-on-1 private chat,
    // fallback to revealing directly in the chat.
    if (!targetChatId && !msg.isGroup) {
      targetChatId = msg.chatId;
    }

    if (!targetChatId) {
      console.warn('[AUTO-VV] No target chat available to forward view-once media');
      return;
    }

    // Always use the raw message object directly — it contains the media key + URL needed by Baileys
    const msgToDownload = this.client.getCachedMessage(msg.id) ?? (rawMsg as any);

    try {
      console.log(`[AUTO-VV] Attempting download of view-once ${mediaType} (msg ${msg.id})`);
      const buffer = await this.client.downloadMedia(msgToDownload);

      const senderNum = msg.senderNumber || msg.senderJid.split('@')[0].split(':')[0];
      const chatLabel = msg.isGroup
        ? ` from group ${msg.chatId.split('@')[0]} (by +${senderNum})`
        : ` from +${senderNum}`;

      console.log(`[AUTO-VV] Auto-forwarding view-once ${mediaType} to ${targetChatId}${chatLabel}`);

      await this.client.sendMedia(targetChatId, buffer, mediaType, {
        caption: `🔓 Auto-revealed view-once${chatLabel}`,
      });
      console.log(`[AUTO-VV] Successfully forwarded to ${targetChatId}`);
    } catch (err: any) {
      console.error(`[AUTO-VV] Download/forward failed for ${msg.id}:`, err?.message ?? err);
    }
  }

  public async handleMessage(msg: NormalizedMessage): Promise<void> {
    const env = getEnv();

    // Fetch dynamic prefix from database if updated, or fall back to '.'
    let prefix = '.';
    try {
      const dbSetting = await db.getSetting('prefix');
      if (dbSetting?.value) prefix = dbSetting.value;
    } catch {}

    const text = msg.body.trim();

    // 0. Auto-view-once reveal: silently extract and forward to owner's private chat.
    //    This fires for ANY incoming view-once message (group or private) from any sender.
    //    The bot owner never loses view-once media — it lands in their DM automatically.
    let autoVvEnabled = true;
    try {
      const autoVvSetting = await db.getSetting('AUTO_VV_ENABLED');
      if (autoVvSetting) autoVvEnabled = autoVvSetting.value !== 'false';
    } catch {}

    if (autoVvEnabled && msg.isViewOnce && !msg.fromMe) {
      this.handleAutoVv(msg).catch((err) => {
        console.error('Auto-vv failed:', err);
      });
    }

    // 1. Command detection
    if (text.startsWith(prefix)) {
      const parts = text.slice(prefix.length).trim().split(/\s+/);
      const commandName = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      if (!commandName) return;

      const plugin = registry.getCommand(commandName);
      if (!plugin) return;

      // 2. Merge database command overrides (dashboard command configuration)
      let dbConfig: { enabled?: boolean; ownerOnly?: boolean } | null = null;
      try {
        dbConfig = await db.getCommandConfig(plugin.name);
      } catch {
        // DB unavailable — use plugin defaults
      }

      const enabled = dbConfig && dbConfig.enabled !== undefined ? dbConfig.enabled : plugin.enabled;
      if (!enabled) return;

      const effectiveOwnerOnly = dbConfig && dbConfig.ownerOnly !== undefined ? dbConfig.ownerOnly : plugin.ownerOnly;

      // 3. Owner authorization — MUST occur BEFORE parsing/execution.
      //    Fail closed on: missing owner config, unresolved sender identity,
      //    LID without PN resolution, or any non-matching phone number.
      const ownerDigits = await resolveOwnerPhone();

      // Only a resolved phone identity may be authorized. `senderResolved` is
      // false when the sender arrived as a LID with no PN mapping.
      const senderDigits = msg.senderResolved ? normalizePhoneNumber(msg.senderNumber) : '';

      const callerIsOwner = isAuthorizedOwner(senderDigits, ownerDigits, msg.fromMe);

      if (!callerIsOwner && effectiveOwnerOnly) {
        await this.denyCommand(msg, plugin.name, senderDigits);
        return;
      }

      // 4. Permission determination
      //    Owner = message from the bot's own linked account OR sender phone
      //    matches the configured owner number.
      //    ADMIN = WhatsApp group admin (only relevant for commands that were
      //    deliberately configured as public).
      let callerRole: Role = callerIsOwner ? 'OWNER' : 'PUBLIC';

      if (!callerIsOwner && msg.isGroup) {
        try {
          const socket = (this.client as any).socket;
          if (socket && typeof socket.groupMetadata === 'function') {
            const meta = await socket.groupMetadata(msg.chatId);
            const senderClean = msg.senderJid.split('@')[0].split(':')[0];
            const isGroupAdmin = (meta?.participants || []).some((p: any) => {
              const pClean = (p.id || '').split('@')[0].split(':')[0];
              return pClean === senderClean && (p.admin === 'admin' || p.admin === 'superadmin');
            });
            if (isGroupAdmin) callerRole = 'ADMIN';
          }
        } catch {
          // Group metadata fetch failed — default to PUBLIC
        }
      }

      // 5. Cooldown / Rate Limiting (bypassed for bot owner self-commands)
      const cooldownKey = `cmd_${plugin.name}_${msg.senderJid}`;
      if (!msg.fromMe && commandRateLimiter.isRateLimited(cooldownKey)) {
        await this.client.sendMessage(
          msg.chatId,
          `⏳ Please wait before using \`${prefix}${plugin.name}\` again.`
        );
        return;
      }

      try {
        await db.createAuditLog({
          action: 'COMMAND_ALLOWED',
          actor: senderDigits || (msg.fromMe ? 'self' : 'unknown'),
          details: `command=${plugin.name} allowed (authorized owner)`,
        });
      } catch {
        // Audit logging is best-effort
      }

      // 6. Execution Context construction
      const socket = (this.client as any).socket;
      const ctx = {
        client: this.client,
        message: msg,
        msg,
        args,
        prefix,
        callerRole,
        reply: (content: string | { text: string }) => this.client.sendMessage(msg.chatId, content),
        replyMedia: (
          media: Buffer,
          type: 'image' | 'video' | 'audio' | 'sticker',
          options: { caption?: string; mimetype?: string } = {}
        ) => this.client.sendMedia(msg.chatId, media, type, options),
        // Send video with optional gifPlayback (for .togif)
        replyWithVideo: async (media: Buffer, mimetype: string, gifPlayback = false, caption?: string) => {
          if (socket && typeof socket.sendMessage === 'function') {
            return socket.sendMessage(msg.chatId, {
              video: media,
              mimetype,
              gifPlayback,
              ...(caption ? { caption } : {}),
            });
          }
          return this.client.sendMedia(msg.chatId, media, 'video', { caption });
        },
        // Send audio as voice note (for .toaudio)
        replyWithAudio: async (media: Buffer, mimetype: string) => {
          if (socket && typeof socket.sendMessage === 'function') {
            return socket.sendMessage(msg.chatId, {
              audio: media,
              mimetype,
              ptt: false,
            });
          }
          return this.client.sendMedia(msg.chatId, media, 'audio');
        },
        // Download media from the quoted/replied-to message (for .toaudio, .togif)
        downloadQuotedMedia: async (): Promise<Buffer> => {
          const contextInfo = msg.rawMessage?.message?.extendedTextMessage?.contextInfo;
          const quotedMsg = contextInfo?.quotedMessage;
          const quotedStanzaId = contextInfo?.stanzaId;
          const quotedParticipant = contextInfo?.participant || msg.chatId;

          if (!quotedMsg) throw new Error('No quoted message found');

          // Try to get cached original message first (has full media keys)
          if (quotedStanzaId) {
            const cached = this.client.getCachedMessage(quotedStanzaId);
            if (cached) {
              return this.client.downloadMedia(cached);
            }
          }

          // Build a synthetic message object for Baileys downloadMediaMessage
          const syntheticMsg = {
            key: { id: quotedStanzaId || 'quoted', remoteJid: msg.chatId, participant: quotedParticipant },
            message: quotedMsg,
          };
          return this.client.downloadMedia(syntheticMsg);
        },
        // Fetch group metadata from Baileys socket (for .admins)
        getGroupMetadata: async () => {
          if (!msg.isGroup) return null;
          try {
            if (socket && typeof socket.groupMetadata === 'function') {
              return await socket.groupMetadata(msg.chatId);
            }
            return null;
          } catch {
            return null;
          }
        },
      };

      try {
        const runFn = plugin.execute || plugin.handler;
        if (typeof runFn === 'function') {
          await runFn(ctx);
        } else {
          throw new Error(`Command .${plugin.name} has no executable handler.`);
        }
      } catch (err: any) {
        console.error(`Error running command ${plugin.name}:`, err);
        await this.client.sendMessage(msg.chatId, `❌ Command execution failed: ${err.message || 'Unknown error'}`);
      }
      return;
    }

    // 7. Ignore non-command outbound self messages (prevent auto-replying to own chat texts)
    if (msg.fromMe) return;

    // 8. Fallback to Auto-Reply Engine for incoming messages
    //    Auto-reply targeting is separate from command authorization — a target
    //    contact receives auto-responses but gains NO control over the bot.
    await processAutoReplies(this.client, msg);
  }
}
