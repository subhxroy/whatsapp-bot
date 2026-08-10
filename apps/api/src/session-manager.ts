import { WhatsAppClient, hasSavedSession } from '@private-md-bot/whatsapp';
import type { DeletedMessageEvent, HistoryMessageEvent } from '@private-md-bot/whatsapp';
import { CommandDispatcher } from '@private-md-bot/commands';
import { db } from '@private-md-bot/database';
import {
  contentBodyAllowed,
  contentRetentionMs,
  retainedUntilIso,
} from '@private-md-bot/database';
import { getEnv } from '@private-md-bot/config';
import { canConnectWhatsApp } from './payment-gate';
import pino from 'pino';

const logger = pino({ level: 'info' });

const HISTORY_FLUSH_INTERVAL_MS = 10_000;
const HISTORY_BATCH_LIMIT = 50;
const HISTORY_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const HISTORY_DEFAULT_KEEP = 2000;

interface HistoryBufferEntry extends Omit<HistoryMessageEvent, 'timestamp'> {
  timestamp: string;
}

export class SessionManager {
  private sessions = new Map<string, WhatsAppClient>();
  private historyBuffer = new Map<string, HistoryBufferEntry[]>();
  private historyFlushTimer: ReturnType<typeof setInterval> | null = null;
  private historyPruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Flush buffered history periodically without blocking process exit.
    this.historyFlushTimer = setInterval(() => {
      this.flushHistory().catch((err) => logger.error({ err }, 'History flush failed'));
    }, HISTORY_FLUSH_INTERVAL_MS);
    this.historyFlushTimer.unref?.();

    this.historyPruneTimer = setInterval(() => {
      this.pruneHistory().catch((err) => logger.error({ err }, 'History prune failed'));
    }, HISTORY_PRUNE_INTERVAL_MS);
    this.historyPruneTimer.unref?.();
  }

  getOrCreate(userId: string): WhatsAppClient {
    let client = this.sessions.get(userId);
    if (!client) {
      client = new WhatsAppClient(`user_${userId}`, userId);
      const dispatcher = new CommandDispatcher(client);
      client.onMessage(async (msg) => {
        await dispatcher.handleMessage(msg);
      });
      client.onDeletedMessage(async (event) => {
        await this.persistDeletedMessage(userId, event);
      });
      client.onHistoryMessage(async (event) => {
        this.bufferHistory(userId, event);
      });
      // Persist the connected WhatsApp phone number to the user record
      // so it can be shown per-user in the dashboard settings.
      client.onStatusChange(async (status) => {
        if (status === 'CONNECTED') {
          const phone = client!.getConnectedPhone();
          if (phone) {
            db.setUserConnectedPhone(userId, phone).catch((err) =>
              logger.error({ err, userId }, 'Failed to persist connected phone')
            );
          }
        }
      });
      this.sessions.set(userId, client);
      logger.info({ userId }, 'Created new WhatsApp session with command dispatcher');
    }
    return client;
  }

  get(userId: string): WhatsAppClient | undefined {
    return this.sessions.get(userId);
  }

  async connect(userId: string): Promise<void> {
    const client = this.getOrCreate(userId);
    await client.connect();
  }

  async disconnect(userId: string): Promise<boolean> {
    const client = this.sessions.get(userId);
    if (!client) return false;
    await client.disconnect();
    this.sessions.delete(userId);
    logger.info({ userId }, 'Disconnected and removed WhatsApp session');
    return true;
  }

  remove(userId: string): void {
    this.sessions.delete(userId);
  }

  getStatus(userId: string): { status: string; qrCode: string | null; connectedPhone: string | null } {
    const client = this.sessions.get(userId);
    if (!client) return { status: 'DISCONNECTED', qrCode: null, connectedPhone: null };
    return { status: client.getStatus(), qrCode: client.getQRCode(), connectedPhone: client.getConnectedPhone() };
  }

  isConnected(userId: string): boolean {
    const client = this.sessions.get(userId);
    return client?.getStatus() === 'CONNECTED';
  }

  /**
   * Find a client whose userId matches the sender's JID prefix.
   * Used by the scheduler as fallback when exact lookup fails.
   * Compares the userId (session key) to the phone-number part of the senderJid.
   */
  getClientForMessage(senderJid: string): WhatsAppClient | undefined {
    const senderPhone = senderJid.split('@')[0].split(':')[0].replace(/\D/g, '');

    // First: exact session key match by phone number.
    // SECURITY: digits-normalized exact comparison only — substring/includes
    // matching would route a message to the wrong session when one phone number
    // contains another (e.g. 917000000000 inside 1917000000000).
    for (const [userId, client] of this.sessions) {
      const sessionPhone = userId.replace(/\D/g, '');
      if (sessionPhone === senderPhone && client.getStatus() === 'CONNECTED') {
        return client;
      }
    }

    // No match found — do NOT return a random client (security: prevents wrong-user sends)
    return undefined;
  }

  private async persistDeletedMessage(userId: string, event: DeletedMessageEvent): Promise<void> {
    try {
      const env = getEnv();
      const allowBody = contentBodyAllowed(env.MESSAGE_CONTENT_RETENTION);
      const body = allowBody && event.body ? event.body : undefined;
      const record = {
        userId,
        chatId: event.chatId,
        senderJid: event.senderJid,
        senderNumber: event.senderNumber,
        senderResolved: event.senderResolved,
        fromMe: event.fromMe,
        messageType: event.messageType,
        body,
        hasMedia: event.hasMedia,
        mediaType: event.mediaType ?? null,
        originalMessageId: event.deletedMessageId,
        originalTimestamp: event.originalTimestamp,
        deletedAt: new Date(event.deletedAt * 1000).toISOString(),
        contentAvailable: !!body,
        retainedUntil: retainedUntilIso(env.DELETED_MESSAGE_RETENTION),
      };
      await db.createDeletedMessage(record);
    } catch (err) {
      logger.error({ err, userId }, 'Failed to persist deleted message');
    }
  }

  private bufferHistory(userId: string, event: HistoryMessageEvent): void {
    let entries = this.historyBuffer.get(userId);
    if (!entries) {
      entries = [];
      this.historyBuffer.set(userId, entries);
    }
    entries.push({ ...event, timestamp: new Date(event.timestamp).toISOString() });
    if (entries.length >= HISTORY_BATCH_LIMIT) {
      this.flushHistory(userId).catch((err) => logger.error({ err, userId }, 'History flush failed'));
    }
  }

  private async flushHistory(userId?: string): Promise<void> {
    const env = getEnv();
    const allowBody = contentBodyAllowed(env.MESSAGE_CONTENT_RETENTION);
    const targets = userId ? [userId] : [...this.historyBuffer.keys()];
    for (const uid of targets) {
      const entries = this.historyBuffer.get(uid) || [];
      if (entries.length === 0) continue;
      this.historyBuffer.set(uid, []);
      try {
        await db.appendMessageHistory(
          uid,
          entries.map((e) => ({
            messageId: e.messageId,
            chatId: e.chatId,
            senderJid: e.senderJid,
            senderNumber: e.senderNumber,
            fromMe: e.fromMe,
            isGroup: e.isGroup,
            messageType: e.messageType,
            body: allowBody ? e.body : undefined,
            hasMedia: e.hasMedia,
            mediaType: e.mediaType ?? null,
            isViewOnce: e.isViewOnce,
            timestamp: e.timestamp,
          }))
        );
      } catch (err) {
        logger.error({ err, userId: uid }, 'Failed to flush message history');
        // Re-buffer failed batch for the next flush (bounded).
        const current = this.historyBuffer.get(uid) || [];
        this.historyBuffer.set(uid, [...entries, ...current].slice(0, HISTORY_BATCH_LIMIT * 2));
      }
    }
  }

  private async pruneHistory(): Promise<void> {
    const env = getEnv();
    const retentionMs = contentRetentionMs(env.MESSAGE_CONTENT_RETENTION);
    if (retentionMs === null) return;
    try {
      const olderThan = new Date(Date.now() - retentionMs).toISOString();
      const pruned = await db.pruneMessageHistory(olderThan, HISTORY_DEFAULT_KEEP);
      if (pruned > 0) logger.info({ pruned }, 'Pruned expired message history');
    } catch (err) {
      logger.error({ err }, 'History prune failed');
    }
  }

  async connectAllApproved(): Promise<void> {
    try {
      const users = await db.getAllUsers();
      let connected = 0;

      for (const user of users) {
        // SECURITY: single authoritative payment gate (same as connect/pair-code
        // routes). Startup connection must follow the same policy.
        const allowed = await canConnectWhatsApp(user);
        if (!allowed) continue;

        const userId = user.username || user.id;
        // Only auto-connect users on startup who ALREADY have an authenticated WhatsApp session saved in Firestore.
        // Users without saved credentials will connect on-demand when they open the dashboard or request a QR/pairing code.
        const hasSession = await hasSavedSession(userId);
        if (!hasSession) continue;

        try {
          // Canonical session id = username (matches payment flow + connect routes).
          const client = this.getOrCreate(userId);
          client.onStatusChange((status) => {
            logger.info({ userId: user.id, status }, 'Session status changed');
          });
          await client.connect();
          connected++;
        } catch (err: any) {
          logger.error({ userId: user.id, err: err.message }, 'Failed to connect user session');
        }
      }

      logger.info({ total: users.length, connected }, 'Startup session connect complete');
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to load approved users for startup connect');
    }
  }

  getConnectedCount(): number {
    let count = 0;
    for (const [, client] of this.sessions) {
      if (client.getStatus() === 'CONNECTED') count++;
    }
    return count;
  }
}
