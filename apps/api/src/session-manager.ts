import { WhatsAppClient } from '@private-md-bot/whatsapp';
import { CommandDispatcher } from '@private-md-bot/commands';
import { db } from '@private-md-bot/database';
import pino from 'pino';

const logger = pino({ level: 'info' });

const EXEMPT_EMAILS = ['contact.subhroy@gmail.com', 'aarxslan@gmail.com', 'admin', 'admin@openify.studio'];

export class SessionManager {
  private sessions = new Map<string, WhatsAppClient>();

  getOrCreate(userId: string): WhatsAppClient {
    let client = this.sessions.get(userId);
    if (!client) {
      client = new WhatsAppClient(`user_${userId}`);
      const dispatcher = new CommandDispatcher(client);
      client.onMessage(async (msg) => {
        await dispatcher.handleMessage(msg);
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

  getStatus(userId: string): { status: string; qrCode: string | null } {
    const client = this.sessions.get(userId);
    if (!client) return { status: 'DISCONNECTED', qrCode: null };
    return { status: client.getStatus(), qrCode: client.getQRCode() };
  }

  isConnected(userId: string): boolean {
    const client = this.sessions.get(userId);
    return client?.getStatus() === 'CONNECTED';
  }

  getClientByJid(jid: string): WhatsAppClient | undefined {
    const normalizedJid = jid.split(':')[0].split('@')[0] + '@s.whatsapp.net';
    for (const [, client] of this.sessions) {
      if (client.getStatus() === 'CONNECTED' && client.getJid() === normalizedJid) {
        return client;
      }
    }
    return undefined;
  }

  getClientForMessage(senderJid: string): WhatsAppClient | undefined {
    for (const [, client] of this.sessions) {
      if (client.getStatus() === 'CONNECTED') return client;
    }
    return undefined;
  }

  async connectAllApproved(): Promise<void> {
    try {
      const users = await db.getAllUsers();
      let connected = 0;

      for (const user of users) {
        const identifier = user.username || user.id || '';
        const isExempt = EXEMPT_EMAILS.some((e) => e.toLowerCase() === identifier.toLowerCase());
        const isOwnerOrAdmin = user.role === 'OWNER' || user.role === 'ADMIN';

        if (!isExempt && !isOwnerOrAdmin) {
          const payment = await db.getUserPaymentStatus(identifier);
          if (!payment.isApproved) continue;
        }

        try {
          const client = this.getOrCreate(user.id);
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
