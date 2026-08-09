import { NormalizedMessage, WhatsAppClient } from '@private-md-bot/whatsapp';
import { registry } from './registry';
import { processAutoReplies } from './auto-reply';
import { getEnv } from '@private-md-bot/config';
import { isOwner, RateLimiter, Role } from '@private-md-bot/security';
import { db } from '@private-md-bot/database';

const commandRateLimiter = new RateLimiter(5000, 3); // 3 commands per 5s default

export class CommandDispatcher {
  private client: WhatsAppClient;

  constructor(client: WhatsAppClient) {
    this.client = client;
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

    console.log(`[DIAG][DISPATCHER] message received id=${msg.id} senderNumber=${msg.senderNumber} chatId=${msg.chatId} fromMe=${msg.fromMe} startsWithPrefix=${text.startsWith(prefix)} bodyLen=${text.length}`);

    // 1. Command detection
    if (text.startsWith(prefix)) {
      const parts = text.slice(prefix.length).trim().split(/\s+/);
      const commandName = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      if (!commandName) return;

      const plugin = registry.getCommand(commandName);
      if (!plugin || !plugin.enabled) return;

      // 2. Permission determination
      // Owner = fromMe OR matches BOT_OWNER_NUMBER
      // Admin = is a WhatsApp group admin in this chat
      const callerIsOwner = msg.fromMe || isOwner(msg.senderJid, env.BOT_OWNER_NUMBER, msg.fromMe);
      let callerRole: Role = callerIsOwner ? 'OWNER' : 'PUBLIC';

      // Check group admin status when the command needs it and we have a group message
      if (!callerIsOwner && msg.isGroup && (plugin.ownerOnly === false)) {
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

      if (plugin.ownerOnly && callerRole !== 'OWNER') {
        await this.client.sendMessage(
          msg.chatId,
          '⛔ Access Denied: This command is restricted to the bot owner.'
        );
        return;
      }

      // 3. Cooldown / Rate Limiting (bypassed for bot owner self-commands)
      const cooldownKey = `cmd_${plugin.name}_${msg.senderJid}`;
      if (!msg.fromMe && commandRateLimiter.isRateLimited(cooldownKey)) {
        await this.client.sendMessage(
          msg.chatId,
          `⏳ Please wait before using \`${prefix}${plugin.name}\` again.`
        );
        return;
      }

      // 4. Execution Context construction
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

    // 5. Ignore non-command outbound self messages (prevent auto-replying to own chat texts)
    if (msg.fromMe) return;

    // 6. Fallback to Auto-Reply Engine for incoming messages
    await processAutoReplies(this.client, msg);
  }
}
