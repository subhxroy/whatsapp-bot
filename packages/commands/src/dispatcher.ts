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

    // 1. Command detection
    if (text.startsWith(prefix)) {
      const parts = text.slice(prefix.length).trim().split(/\s+/);
      const commandName = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      if (!commandName) return;

      const plugin = registry.getCommand(commandName);
      if (!plugin || !plugin.enabled) return;

      // 2. Permission determination (Owner status is true if fromMe or matches BOT_OWNER_NUMBER)
      const callerIsOwner = msg.fromMe || isOwner(msg.senderJid, env.BOT_OWNER_NUMBER, msg.fromMe);
      const callerRole: Role = callerIsOwner ? 'OWNER' : 'PUBLIC';

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
      const ctx = {
        client: this.client,
        message: msg,
        args,
        prefix,
        callerRole,
        reply: (content: string | { text: string }) => this.client.sendMessage(msg.chatId, content),
        replyMedia: (
          media: Buffer,
          type: 'image' | 'video' | 'audio' | 'sticker',
          options: { caption?: string; mimetype?: string } = {}
        ) => this.client.sendMedia(msg.chatId, media, type, options),
      };

      try {
        await plugin.execute(ctx);
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
