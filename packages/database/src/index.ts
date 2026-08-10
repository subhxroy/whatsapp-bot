import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps, getApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Firestore, Timestamp } from 'firebase-admin/firestore';
import { scheduleVisibleToUser } from './schedule-utils';
import { mostRecentPaymentRequest } from './payment-utils';

export type MatchType = 'EXACT' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'REGEX' | 'ANY';
export type Role = 'PUBLIC' | 'ADMIN' | 'OWNER';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  totpSecret: string | null;
  totpEnabled: boolean;
  googleUid: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppSession {
  id: string;
  sessionKey: string;
  encryptedData: string;
  updatedAt: string;
}

export interface CommandConfig {
  id: string;
  name: string;
  enabled: boolean;
  aliases: string;
  cooldown: number;
  ownerOnly: boolean;
  description: string | null;
  category: string;
  updatedAt: string;
}

export interface AutoReply {
  id: string;
  userId?: string | null;
  trigger: string;
  matchType: MatchType;
  specificNumber?: string | null;
  response: string;
  enabled: boolean;
  priority: number;
  cooldown: number;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actor: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userEmail: string;
  utrNumber: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export type ScheduleStatus =
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'PROCESSING'
  | 'PAUSED'
  | 'CANCELLED'
  | 'DRAFT';

export type ScheduleEventType =
  | 'SCHEDULE_CREATED'
  | 'SCHEDULE_UPDATED'
  | 'SCHEDULE_DELETED'
  | 'SCHEDULE_CANCELLED'
  | 'SCHEDULE_PAUSED'
  | 'SCHEDULE_RESUMED'
  | 'SCHEDULE_DUPLICATED'
  | 'SCHEDULE_RETRIED'
  | 'DELIVERY_ATTEMPT'
  | 'DELIVERY_SENT'
  | 'DELIVERY_FAILED';

export interface ScheduledMessage {
  id: string;
  userId?: string | null;
  targetNumber: string;
  targetJid: string;
  message: string;
  scheduledAt: string;
  senderJid: string;
  type: 'BIRTHDAY' | 'SCHEDULED';
  status: ScheduleStatus;
  createdAt: string;
  updatedAt?: string;
  title?: string;
  deliveryAttempts?: number;
  lastAttemptAt?: string;
  lastError?: string;
  sentAt?: string;
  sentMessageId?: string;
  sourceScheduleId?: string;
}

export interface MessageEvent {
  id: string;
  scheduleId: string;
  userId: string | null;
  eventType: ScheduleEventType;
  status?: ScheduleStatus;
  attempt?: number;
  errorCode?: string;
  errorMessage?: string;
  messageId?: string;
  targetNumber?: string;
  timestamp: string;
}

export interface DeletedMessage {
  id: string;
  userId: string | null;
  chatId: string;
  senderJid: string;
  senderNumber: string;
  senderResolved: boolean;
  fromMe: boolean;
  messageType: string;
  body?: string | null;
  hasMedia: boolean;
  mediaType?: string | null;
  originalMessageId: string;
  originalTimestamp?: number;
  deletedAt: string;
  contentAvailable: boolean;
  retainedUntil: string;
}

export interface Template {
  id: string;
  userId: string;
  name: string;
  message: string;
  type: 'SCHEDULED' | 'BIRTHDAY';
  createdAt: string;
  updatedAt: string;
}

export interface MessageHistoryRecord {
  id: string;
  userId: string | null;
  messageId: string;
  chatId: string;
  senderJid: string;
  senderNumber: string;
  fromMe: boolean;
  isGroup: boolean;
  messageType: string;
  body?: string | null;
  hasMedia: boolean;
  mediaType?: string | null;
  isViewOnce: boolean;
  timestamp: string;
}

let cachedDb: Firestore | null = null;

export async function resetDb(): Promise<void> {
  cachedDb = null;
  if (getApps().length > 0) {
    try {
      await deleteApp(getApp());
    } catch {
      // ignore app cleanup errors
    }
  }
}

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;

  let app;
  if (getApps().length > 0) {
    app = getApp();
  } else {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const googlePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    const candidatePaths: string[] = [];
    if (serviceAccountPath) candidatePaths.push(serviceAccountPath);
    if (googlePath) candidatePaths.push(googlePath);
    candidatePaths.push(
      'openify-studio-firebase-adminsdk-fbsvc-8938483736.json',
      './openify-studio-firebase-adminsdk-fbsvc-8938483736.json',
      'firebase-service-account.json'
    );

    let resolvedContent: string | null = null;

    if (serviceAccountJson) {
      resolvedContent = serviceAccountJson;
    } else {
      for (const relPath of candidatePaths) {
        const abs1 = path.isAbsolute(relPath) ? relPath : path.resolve(process.cwd(), relPath);
        const abs2 = path.resolve(process.cwd(), '../../', relPath.replace(/^\.\//, ''));
        const abs3 = path.resolve(__dirname, '../../../', relPath.replace(/^\.\//, ''));

        for (const target of [abs1, abs2, abs3]) {
          if (fs.existsSync(target)) {
            resolvedContent = fs.readFileSync(target, 'utf8');
            break;
          }
        }
        if (resolvedContent) break;
      }
    }

    if (resolvedContent) {
      let parsed: any;
      try {
        parsed = typeof resolvedContent === 'string' ? JSON.parse(resolvedContent) : resolvedContent;
      } catch (err: any) {
        throw new Error(`Failed to parse Firebase service account JSON: ${err?.message}`);
      }

      if (parsed && typeof parsed.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }

      app = initializeApp({ credential: cert(parsed) });
    } else if (projectId) {
      app = initializeApp({ projectId });
    } else {
      throw new Error(
        'Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT, GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_PROJECT_ID.'
      );
    }
  }

  const firestore = getFirestore(app);

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    firestore.settings({ host: emulatorHost, ssl: false });
  }

  cachedDb = firestore;
  return firestore;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toDateString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return (value as string) ?? nowIso();
}

function collection(name: string) {
  return getDb().collection(name);
}

const CLOSED_ERROR_PATTERNS = [
  'closing',
  'closed',
  'hidden',
  'unavailable',
  'deadline_exceeded',
  'not_found',
  'goaway',
  'rst_stream',
  'channel shutdown',
  'service unavailable',
  'connection reset',
  'socket hang up',
  'econnreset',
];

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = (err?.message || String(err)).toLowerCase();
    const isClosedError = CLOSED_ERROR_PATTERNS.some((pattern) => msg.includes(pattern));
    if (isClosedError) {
      console.warn('⚠️ Firestore connection error detected — resetting app & DB instance...', err?.message);
      await resetDb();
      return await fn();
    }
    throw err;
  }
}

const users = () => collection('users');
const sessions = () => collection('sessions');
const settingsCol = () => collection('settings');
const commandConfigs = () => collection('commandConfigs');
const autoReplies = () => collection('autoReplies');
const auditLogs = () => collection('auditLogs');
const payments = () => collection('payments');
const scheduledCol = () => collection('scheduledMessages');
const messageEventsCol = () => collection('messageEvents');
const deletedMessagesCol = () => collection('deletedMessages');
const templatesCol = () => collection('templates');
const messageHistoryCol = () => collection('messageHistory');

export const db = {
  // ---------- Users ----------
  async countUsers(): Promise<number> {
    return withRetry(async () => {
      const snap = await users().count().get();
      return snap.data().count;
    });
  },

  async getAllUsers(): Promise<User[]> {
    return withRetry(async () => {
      const snap = await users().get();
      return snap.docs.map((doc) => {
        const data = doc.data() as Omit<User, 'id'>;
        return { ...data, id: doc.id, username: data.username ?? doc.id };
      });
    });
  },

  async createUser(data: {
    username: string;
    passwordHash: string;
    role: string;
    googleUid?: string | null;
  }): Promise<User> {
    return withRetry(async () => {
      const now = nowIso();
      const user: User = {
        id: data.username,
        username: data.username,
        passwordHash: data.passwordHash,
        totpSecret: null,
        totpEnabled: false,
        googleUid: data.googleUid ?? null,
        role: data.role,
        createdAt: now,
        updatedAt: now,
      };
      await users().doc(data.username).set(user);
      return user;
    });
  },

  async findUserByUsername(username: string): Promise<User | null> {
    return withRetry(async () => {
      const doc = await users().doc(username).get();
      if (doc.exists) {
        const data = doc.data() as Omit<User, 'id'>;
        return {
          ...data,
          id: doc.id,
          username: data.username ?? username,
          googleUid: data.googleUid ?? null,
        };
      }

      const snap = await users().where('email', '==', username).limit(1).get();
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        return {
          id: d.id,
          username: data.username ?? data.email ?? username,
          passwordHash: data.passwordHash ?? '',
          totpSecret: data.totpSecret ?? null,
          totpEnabled: !!data.totpEnabled,
          googleUid: data.googleUid ?? d.id,
          role: data.role ?? 'USER',
          createdAt: toDateString(data.createdAt),
          updatedAt: toDateString(data.updatedAt),
        };
      }
      return null;
    });
  },

  async findUserById(id: string): Promise<User | null> {
    return withRetry(async () => {
      const doc = await users().doc(id).get();
      if (doc.exists) {
        const data = doc.data() as Omit<User, 'id'>;
        return {
          ...data,
          id: doc.id,
          username: data.username ?? id,
          googleUid: data.googleUid ?? null,
        };
      }

      const snap = await users().where('id', '==', id).limit(1).get();
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        return {
          id: d.id,
          username: data.username ?? data.email ?? id,
          passwordHash: data.passwordHash ?? '',
          totpSecret: data.totpSecret ?? null,
          totpEnabled: !!data.totpEnabled,
          googleUid: data.googleUid ?? d.id,
          role: data.role ?? 'USER',
          createdAt: toDateString(data.createdAt),
          updatedAt: toDateString(data.updatedAt),
        };
      }
      return null;
    });
  },

  async setUserGoogleUid(username: string, googleUid: string): Promise<void> {
    return withRetry(async () => {
      await users().doc(username).set({ googleUid }, { merge: true });
    });
  },

  // ---------- WhatsApp Sessions ----------
  async listSessionsForOwner(ownerSession: string): Promise<string[]> {
    return withRetry(async () => {
      const snap = await sessions().where('ownerSession', '==', ownerSession).get();
      return snap.docs.map((doc) => doc.id);
    });
  },

  async getSession(sessionKey: string): Promise<{ encryptedData: string; updatedAt: string } | null> {
    return withRetry(async () => {
      const doc = await sessions().doc(sessionKey).get();
      if (!doc.exists) return null;
      const data = doc.data() as { encryptedData: string; updatedAt?: string };
      return { encryptedData: data.encryptedData, updatedAt: toDateString(data.updatedAt) };
    });
  },

  async upsertSession(sessionKey: string, encryptedData: string, ownerSession?: string): Promise<void> {
    return withRetry(async () => {
      await sessions().doc(sessionKey).set(
        {
          sessionKey,
          ownerSession: ownerSession || sessionKey,
          encryptedData,
          updatedAt: nowIso(),
        },
        { merge: true }
      );
    });
  },

  async deleteSession(sessionKey: string): Promise<void> {
    return withRetry(async () => {
      await sessions().doc(sessionKey).delete();
    });
  },

  // ---------- Settings ----------
  async getSettings(): Promise<Setting[]> {
    return withRetry(async () => {
      const snap = await settingsCol().get();
      const items: Setting[] = snap.docs.map((doc) => {
        const data = doc.data() as Omit<Setting, 'id'>;
        return { ...data, id: doc.id, updatedAt: toDateString(data.updatedAt) };
      });
      return items.sort((a, b) => a.key.localeCompare(b.key));
    });
  },

  async getSetting(key: string): Promise<Setting | null> {
    return withRetry(async () => {
      const doc = await settingsCol().doc(key).get();
      if (!doc.exists) return null;
      const data = doc.data() as Omit<Setting, 'id'>;
      return { ...data, id: doc.id, updatedAt: toDateString(data.updatedAt) };
    });
  },

  async upsertSetting(data: { key: string; value: string; description?: string }): Promise<Setting> {
    return withRetry(async () => {
      const now = nowIso();
      const current = await this.getSetting(data.key);
      const setting: Setting = {
        id: data.key,
        key: data.key,
        value: data.value,
        description: data.description ?? current?.description ?? null,
        updatedAt: now,
      };
      await settingsCol().doc(data.key).set(setting, { merge: true });
      return setting;
    });
  },

  // ---------- Command Configs ----------
  async getCommandConfigs(): Promise<CommandConfig[]> {
    return withRetry(async () => {
      const snap = await commandConfigs().get();
      return snap.docs.map((doc) => {
        const data = doc.data() as Omit<CommandConfig, 'id'>;
        return { ...data, id: doc.id, updatedAt: toDateString(data.updatedAt) };
      });
    });
  },

  async getCommandConfig(name: string): Promise<CommandConfig | null> {
    return withRetry(async () => {
      const doc = await commandConfigs().doc(name).get();
      if (!doc.exists) return null;
      const data = doc.data() as Omit<CommandConfig, 'id'>;
      return { ...data, id: doc.id, updatedAt: toDateString(data.updatedAt) };
    });
  },

  async upsertCommandConfig(data: {
    name: string;
    enabled?: boolean;
    aliases?: string;
    cooldown?: number;
    ownerOnly?: boolean;
    description?: string | null;
    category?: string;
  }): Promise<CommandConfig> {
    return withRetry(async () => {
      const now = nowIso();
      const existing = await commandConfigs().doc(data.name).get();
      const defaults: CommandConfig = {
        id: data.name,
        name: data.name,
        enabled: true,
        aliases: '[]',
        cooldown: 3,
        ownerOnly: false,
        description: null,
        category: 'general',
        updatedAt: now,
      };
      const base = existing.exists
        ? ({ ...(existing.data() as Omit<CommandConfig, 'id'>), id: data.name } as CommandConfig)
        : defaults;
      const config: CommandConfig = {
        ...base,
        name: data.name,
        updatedAt: now,
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.aliases !== undefined && { aliases: data.aliases }),
        ...(data.cooldown !== undefined && { cooldown: data.cooldown }),
        ...(data.ownerOnly !== undefined && { ownerOnly: data.ownerOnly }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
      };
      await commandConfigs().doc(data.name).set(config);
      return config;
    });
  },

  // ---------- Auto Replies ----------
  privateSortAutoReplies(list: AutoReply[]): AutoReply[] {
    return list.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.createdAt.localeCompare(b.createdAt);
    });
  },

  async getAutoReplies(userId?: string, isOwnerOrAdmin?: boolean): Promise<AutoReply[]> {
    return withRetry(async () => {
      const snap = await autoReplies().get();
      let list: AutoReply[] = snap.docs.map((doc) => {
        const data = doc.data() as Omit<AutoReply, 'id'>;
        return { ...data, id: doc.id, userId: data.userId ?? null, createdAt: toDateString(data.createdAt), updatedAt: toDateString(data.updatedAt) };
      });
      if (userId && !isOwnerOrAdmin) {
        list = list.filter((r) => r.userId === userId);
      }
      return this.privateSortAutoReplies(list);
    });
  },

  async getEnabledAutoReplies(userId?: string): Promise<AutoReply[]> {
    const all = await this.getAutoReplies(userId, false);
    return all.filter((r) => (r as any).enabled !== false && (r as any).enabled !== 'false');
  },

  async createAutoReply(data: {
    userId?: string | null;
    trigger: string;
    matchType: MatchType;
    specificNumber?: string | null;
    response: string;
    enabled: boolean;
    priority: number;
    cooldown: number;
  }): Promise<AutoReply> {
    return withRetry(async () => {
      const now = nowIso();
      const ref = autoReplies().doc();
      const rule: AutoReply = {
        id: ref.id,
        userId: data.userId ?? null,
        trigger: data.trigger,
        matchType: data.matchType,
        specificNumber: data.specificNumber ?? null,
        response: data.response,
        enabled: data.enabled,
        priority: data.priority,
        cooldown: data.cooldown,
        createdAt: now,
        updatedAt: now,
      };
      await ref.set(rule);
      return rule;
    });
  },

  async updateAutoReply(
    id: string,
    data: Partial<Omit<AutoReply, 'id' | 'createdAt'>>,
    currentUserId?: string,
    isOwnerOrAdmin?: boolean
  ): Promise<AutoReply | null> {
    return withRetry(async () => {
      const doc = await autoReplies().doc(id).get();
      if (!doc.exists) return null;
      const current = doc.data() as Omit<AutoReply, 'id'>;
      if (!isOwnerOrAdmin && currentUserId && current.userId && current.userId !== currentUserId) {
        return null;
      }
      const updated: AutoReply = {
        ...current,
        ...data,
        id,
        createdAt: toDateString(current.createdAt),
        updatedAt: nowIso(),
      };
      await autoReplies().doc(id).set(updated);
      return updated;
    });
  },

  async deleteAutoReply(id: string, currentUserId?: string, isOwnerOrAdmin?: boolean): Promise<boolean> {
    return withRetry(async () => {
      const doc = await autoReplies().doc(id).get();
      if (!doc.exists) return false;
      const current = doc.data() as Omit<AutoReply, 'id'>;
      if (!isOwnerOrAdmin && currentUserId && current.userId && current.userId !== currentUserId) {
        return false;
      }
      await autoReplies().doc(id).delete();
      return true;
    });
  },

  // ---------- Audit Logs ----------
  async getAuditLogs(params: { take: number; skip: number }): Promise<AuditLog[]> {
    return withRetry(async () => {
      const { take, skip } = params;
      const snap = await auditLogs().orderBy('createdAt', 'desc').offset(skip).limit(take).get();
      return snap.docs.map((doc) => {
        const data = doc.data() as Omit<AuditLog, 'id'>;
        return { ...data, id: doc.id, createdAt: toDateString(data.createdAt) };
      });
    });
  },

  async countAuditLogs(): Promise<number> {
    return withRetry(async () => {
      const snap = await auditLogs().count().get();
      return snap.data().count;
    });
  },

  async createAuditLog(data: {
    action: string;
    actor: string;
    details?: string | null;
    ipAddress?: string | null;
  }): Promise<AuditLog> {
    return withRetry(async () => {
      const now = nowIso();
      const ref = auditLogs().doc();
      const log: AuditLog = {
        id: ref.id,
        action: data.action,
        actor: data.actor,
        details: data.details ?? null,
        ipAddress: data.ipAddress ?? null,
        createdAt: now,
      };
      await ref.set(log);
      return log;
    });
  },

  // ---------- Payments ----------
  async createPaymentRequest(data: {
    userId: string;
    userEmail: string;
    utrNumber: string;
    amount: number;
  }): Promise<PaymentRequest> {
    return withRetry(async () => {
      const now = nowIso();
      const ref = payments().doc();
      const request: PaymentRequest = {
        id: ref.id,
        userId: data.userId,
        userEmail: data.userEmail,
        utrNumber: data.utrNumber,
        amount: data.amount,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      };
      await ref.set(request);
      return request;
    });
  },

  async getPaymentRequests(): Promise<PaymentRequest[]> {
    return withRetry(async () => {
      const snap = await payments().get();
      const list = snap.docs.map((doc) => {
        const data = doc.data() as Omit<PaymentRequest, 'id'>;
        return { ...data, id: doc.id, createdAt: toDateString(data.createdAt), updatedAt: toDateString(data.updatedAt) };
      });
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  },

  async getUserPaymentStatus(userIdOrEmail: string): Promise<{
    isApproved: boolean;
    status: 'UNPAID' | 'PENDING' | 'APPROVED' | 'REJECTED';
    request?: PaymentRequest;
  }> {
    return withRetry(async () => {
      let snap = await payments().where('userId', '==', userIdOrEmail).get();
      if (snap.empty) {
        snap = await payments().where('userEmail', '==', userIdOrEmail).get();
      }
      if (snap.empty) {
        return { isApproved: false, status: 'UNPAID' };
      }
      // SECURITY: the MOST RECENT payment decision wins. Sorting explicitly
      // prevents a stale APPROVED record from overriding a later REJECTED
      // (approve-then-revoke must fail closed).
      const latest = mostRecentPaymentRequest(snap.docs.map((d) => d.data() as PaymentRequest));
      if (!latest) {
        return { isApproved: false, status: 'UNPAID' };
      }
      return { isApproved: latest.status === 'APPROVED', status: latest.status, request: latest };
    });
  },

  async updatePaymentStatus(paymentId: string, status: 'APPROVED' | 'REJECTED'): Promise<PaymentRequest | null> {
    return withRetry(async () => {
      const doc = await payments().doc(paymentId).get();
      if (!doc.exists) return null;
      const current = doc.data() as PaymentRequest;
      const updated: PaymentRequest = {
        ...current,
        status,
        updatedAt: nowIso(),
      };
      await payments().doc(paymentId).set(updated, { merge: true });
      return updated;
    });
  },

  // ---------- Scheduled Messages & Birthday Wishes ----------
  async createScheduledMessage(data: {
    userId?: string | null;
    targetNumber: string;
    targetJid: string;
    message: string;
    scheduledAt: string;
    senderJid: string;
    type?: 'BIRTHDAY' | 'SCHEDULED';
    title?: string;
  }): Promise<ScheduledMessage> {
    return withRetry(async () => {
      const now = nowIso();
      const ref = scheduledCol().doc();
      const record: ScheduledMessage = {
        id: ref.id,
        userId: data.userId ?? null,
        targetNumber: data.targetNumber,
        targetJid: data.targetJid,
        message: data.message,
        scheduledAt: data.scheduledAt,
        senderJid: data.senderJid,
        type: data.type || 'SCHEDULED',
        status: 'PENDING',
        deliveryAttempts: 0,
        createdAt: now,
        updatedAt: now,
      };
      if (data.title) record.title = data.title;
      await ref.set(record);
      return record;
    });
  },

  async getPendingScheduledMessages(): Promise<ScheduledMessage[]> {
    return withRetry(async () => {
      const snap = await scheduledCol().where('status', '==', 'PENDING').get();
      return snap.docs.map((doc) => {
        const data = doc.data() as Omit<ScheduledMessage, 'id'>;
        return { ...data, id: doc.id, userId: data.userId ?? null, createdAt: toDateString(data.createdAt) };
      });
    });
  },

  /** Due + claimable records (PENDING and already past their time). */
  async getDueScheduledMessages(): Promise<ScheduledMessage[]> {
    return withRetry(async () => {
      const snap = await scheduledCol().where('status', '==', 'PENDING').get();
      const now = Date.now();
      return snap.docs
        .map((doc) => {
          const data = doc.data() as Omit<ScheduledMessage, 'id'>;
          return { ...data, id: doc.id, userId: data.userId ?? null, createdAt: toDateString(data.createdAt) };
        })
        .filter((m) => {
          const t = new Date(m.scheduledAt).getTime();
          return !isNaN(t) && t <= now;
        })
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    });
  },

  async listScheduledMessages(options: {
    userId?: string;
    isOwnerOrAdmin?: boolean;
    search?: string;
    status?: string;
    type?: 'BIRTHDAY' | 'SCHEDULED';
    sort?: 'scheduledAt' | 'createdAt' | 'updatedAt';
    order?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<{ messages: ScheduledMessage[]; total: number }> {
    return withRetry(async () => {
      const snap = await scheduledCol().get();
      let list = snap.docs.map((doc) => {
        const data = doc.data() as Omit<ScheduledMessage, 'id'>;
        return { ...data, id: doc.id, userId: data.userId ?? null, createdAt: toDateString(data.createdAt) };
      });
      if (options.userId && !options.isOwnerOrAdmin) {
        // SECURITY: exact-match ownership only (see scheduleVisibleToUser).
        list = list.filter((m) => scheduleVisibleToUser(m, options.userId));
      }
      if (options.status) {
        list = list.filter((m) => m.status === options.status);
      }
      if (options.type) {
        list = list.filter((m) => m.type === options.type);
      }
      if (options.search) {
        const q = options.search.toLowerCase();
        list = list.filter(
          (m) =>
            m.targetNumber.toLowerCase().includes(q) ||
            (m.title || '').toLowerCase().includes(q) ||
            m.message.toLowerCase().includes(q)
        );
      }
      const sortKey = options.sort || 'scheduledAt';
      const order = options.order === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        const av = (a as any)[sortKey] || '';
        const bv = (b as any)[sortKey] || '';
        return av.localeCompare(bv) * order;
      });
      const total = list.length;
      const page = Math.max(1, options.page || 1);
      const pageSize = Math.min(100, Math.max(1, options.pageSize || 50));
      const start = (page - 1) * pageSize;
      return { messages: list.slice(start, start + pageSize), total };
    });
  },

  async getScheduledMessage(id: string, currentUserId?: string, isOwnerOrAdmin?: boolean): Promise<ScheduledMessage | null> {
    return withRetry(async () => {
      const doc = await scheduledCol().doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data() as Omit<ScheduledMessage, 'id'>;
      const record = { ...data, id: doc.id, userId: data.userId ?? null, createdAt: toDateString(data.createdAt) };
      if (!isOwnerOrAdmin && currentUserId && record.userId && record.userId !== currentUserId) {
        return null;
      }
      return record;
    });
  },

  async updateScheduledMessage(
    id: string,
    data: {
      message?: string;
      scheduledAt?: string;
      type?: 'BIRTHDAY' | 'SCHEDULED';
      targetNumber?: string;
      title?: string;
    },
    currentUserId?: string,
    isOwnerOrAdmin?: boolean
  ): Promise<ScheduledMessage | null> {
    return withRetry(async () => {
      const doc = scheduledCol().doc(id);
      const current = await doc.get();
      if (!current.exists) return null;
      const existing = current.data() as Omit<ScheduledMessage, 'id'>;
      if (!isOwnerOrAdmin && currentUserId && existing.userId && existing.userId !== currentUserId) {
        return null;
      }
      const updated: Partial<ScheduledMessage> = { updatedAt: nowIso() };
      if (data.message !== undefined) updated.message = data.message;
      if (data.scheduledAt !== undefined) updated.scheduledAt = data.scheduledAt;
      if (data.type !== undefined) updated.type = data.type;
      if (data.title !== undefined) updated.title = data.title;
      if (data.targetNumber !== undefined) {
        const clean = data.targetNumber.replace(/\D/g, '');
        updated.targetNumber = clean;
        updated.targetJid = `${clean}@s.whatsapp.net`;
      }
      await doc.update(updated);
      const after = await doc.get();
      const afterData = after.data() as Omit<ScheduledMessage, 'id'>;
      return { ...afterData, id, userId: afterData.userId ?? null, createdAt: toDateString(afterData.createdAt) };
    });
  },

  async duplicateScheduledMessage(id: string, currentUserId?: string, isOwnerOrAdmin?: boolean): Promise<ScheduledMessage | null> {
    return withRetry(async () => {
      const doc = await scheduledCol().doc(id).get();
      if (!doc.exists) return null;
      const source = doc.data() as Omit<ScheduledMessage, 'id'>;
      const sourceId = doc.id;
      if (!isOwnerOrAdmin && currentUserId && source.userId && source.userId !== currentUserId) {
        return null;
      }
      const now = nowIso();
      const ref = scheduledCol().doc();
      const sourceTime = new Date(source.scheduledAt).getTime();
      const scheduledAt =
        !isNaN(sourceTime) && sourceTime > Date.now() ? source.scheduledAt : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const record: ScheduledMessage = {
        id: ref.id,
        userId: source.userId,
        targetNumber: source.targetNumber,
        targetJid: source.targetJid,
        message: source.message,
        scheduledAt,
        senderJid: source.senderJid,
        type: source.type,
        status: 'PENDING',
        deliveryAttempts: 0,
        sourceScheduleId: sourceId,
        createdAt: now,
        updatedAt: now,
      };
      if (source.title) record.title = source.title;
      await ref.set(record);
      return record;
    });
  },

  /** Guarded status transition (pause/resume/cancel/retry). Returns updated record or null. */
  async transitionScheduledMessage(
    id: string,
    fromStatuses: ScheduleStatus[],
    toStatus: ScheduleStatus,
    currentUserId?: string,
    isOwnerOrAdmin?: boolean
  ): Promise<ScheduledMessage | null> {
    return withRetry(async () => {
      const doc = scheduledCol().doc(id);
      const current = await doc.get();
      if (!current.exists) return null;
      const existing = current.data() as Omit<ScheduledMessage, 'id'>;
      if (!isOwnerOrAdmin && currentUserId && existing.userId && existing.userId !== currentUserId) {
        return null;
      }
      if (!fromStatuses.includes(existing.status)) return null;
      await doc.update({ status: toStatus, updatedAt: nowIso() });
      const after = await doc.get();
      const afterData = after.data() as Omit<ScheduledMessage, 'id'>;
      return { ...afterData, id, userId: afterData.userId ?? null, createdAt: toDateString(afterData.createdAt) };
    });
  },

  /** Atomically claim a due schedule (PENDING -> PROCESSING) to prevent double-sends. */
  async claimScheduledMessage(id: string): Promise<ScheduledMessage | null> {
    return withRetry(async () => {
      const dbRef = getDb();
      return await dbRef.runTransaction(async (tx) => {
        const docRef = scheduledCol().doc(id);
        const snap = await tx.get(docRef);
        if (!snap.exists) return null;
        const existing = snap.data() as Omit<ScheduledMessage, 'id'>;
        if (existing.status !== 'PENDING') return null;
        const attempts = (existing.deliveryAttempts || 0) + 1;
        const now = nowIso();
        tx.update(docRef, {
          status: 'PROCESSING',
          deliveryAttempts: attempts,
          lastAttemptAt: now,
          updatedAt: now,
        });
        return {
          ...existing,
          id,
          userId: existing.userId ?? null,
          createdAt: toDateString(existing.createdAt),
          status: 'PROCESSING' as ScheduleStatus,
          deliveryAttempts: attempts,
        };
      });
    });
  },

  async markScheduledMessageSent(id: string, sentMessageId?: string): Promise<boolean> {
    return withRetry(async () => {
      const dbRef = getDb();
      return await dbRef.runTransaction(async (tx) => {
        const docRef = scheduledCol().doc(id);
        const snap = await tx.get(docRef);
        if (!snap.exists) return false;
        const existing = snap.data() as Omit<ScheduledMessage, 'id'>;
        if (existing.status !== 'PROCESSING') return false;
        const now = nowIso();
        const update: Record<string, unknown> = { status: 'SENT', sentAt: now, updatedAt: now };
        if (sentMessageId) update.sentMessageId = sentMessageId;
        tx.update(docRef, update);
        return true;
      });
    });
  },

  async markScheduledMessageFailed(id: string, errorMessage?: string): Promise<boolean> {
    return withRetry(async () => {
      const dbRef = getDb();
      return await dbRef.runTransaction(async (tx) => {
        const docRef = scheduledCol().doc(id);
        const snap = await tx.get(docRef);
        if (!snap.exists) return false;
        const existing = snap.data() as Omit<ScheduledMessage, 'id'>;
        if (existing.status !== 'PROCESSING') return false;
        tx.update(docRef, {
          status: 'FAILED',
          lastError: (errorMessage || '').slice(0, 500),
          updatedAt: nowIso(),
        });
        return true;
      });
    });
  },

  /** Recover PROCESSING records that were interrupted (crash/restart mid-delivery). */
  async requeueStaleProcessing(maxAgeMs: number): Promise<number> {
    return withRetry(async () => {
      const snap = await scheduledCol().where('status', '==', 'PROCESSING').get();
      const now = Date.now();
      let requeued = 0;
      for (const doc of snap.docs) {
        const data = doc.data() as Omit<ScheduledMessage, 'id'>;
        const lastAttempt = data.lastAttemptAt ? new Date(data.lastAttemptAt).getTime() : now;
        if (now - lastAttempt > maxAgeMs) {
          await scheduledCol().doc(doc.id).update({ status: 'PENDING', updatedAt: nowIso() });
          requeued++;
        }
      }
      return requeued;
    });
  },

  async deleteScheduledMessage(id: string, currentUserId?: string, isOwnerOrAdmin?: boolean): Promise<boolean> {
    return withRetry(async () => {
      const doc = await scheduledCol().doc(id).get();
      if (!doc.exists) return false;
      const current = doc.data() as Omit<ScheduledMessage, 'id'>;
      if (!isOwnerOrAdmin && currentUserId && current.userId && current.userId !== currentUserId) {
        return false;
      }
      await scheduledCol().doc(id).delete();
      return true;
    });
  },

  // ---------- Message Events (Delivery History) ----------
  async createMessageEvent(data: {
    scheduleId: string;
    userId?: string | null;
    eventType: ScheduleEventType;
    status?: ScheduleStatus;
    attempt?: number;
    errorCode?: string;
    errorMessage?: string;
    messageId?: string;
    targetNumber?: string;
  }): Promise<MessageEvent> {
    return withRetry(async () => {
      const ref = messageEventsCol().doc();
      const record: MessageEvent = {
        id: ref.id,
        scheduleId: data.scheduleId,
        userId: data.userId ?? null,
        eventType: data.eventType,
        status: data.status,
        attempt: data.attempt,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage ? data.errorMessage.slice(0, 500) : undefined,
        messageId: data.messageId,
        targetNumber: data.targetNumber,
        timestamp: nowIso(),
      };
      await ref.set(record);
      return record;
    });
  },

  async getMessageEventsForSchedule(
    scheduleId: string,
    currentUserId?: string,
    isOwnerOrAdmin?: boolean
  ): Promise<MessageEvent[]> {
    return withRetry(async () => {
      const doc = await scheduledCol().doc(scheduleId).get();
      if (!doc.exists) return [];
      const schedule = doc.data() as Omit<ScheduledMessage, 'id'>;
      if (!isOwnerOrAdmin && currentUserId && schedule.userId && schedule.userId !== currentUserId) {
        return [];
      }
      const snap = await messageEventsCol().where('scheduleId', '==', scheduleId).orderBy('timestamp', 'asc').get();
      return snap.docs.map((eventDoc) => {
        const data = eventDoc.data() as Omit<MessageEvent, 'id'>;
        return { ...data, id: eventDoc.id, userId: data.userId ?? null, timestamp: toDateString(data.timestamp) };
      });
    });
  },

  // ---------- Deleted Messages ----------
  async createDeletedMessage(data: Omit<DeletedMessage, 'id'>): Promise<DeletedMessage> {
    return withRetry(async () => {
      const ref = deletedMessagesCol().doc();
      const record: DeletedMessage = { ...data, id: ref.id };
      await ref.set(record);
      return record;
    });
  },

  async listDeletedMessages(options: {
    userId?: string;
    isOwnerOrAdmin?: boolean;
    search?: string;
    chatId?: string;
    fromMe?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ messages: DeletedMessage[]; total: number }> {
    return withRetry(async () => {
      const snap = await deletedMessagesCol().get();
      let list = snap.docs.map((doc) => {
        const data = doc.data() as Omit<DeletedMessage, 'id'>;
        return {
          ...data,
          id: doc.id,
          userId: data.userId ?? null,
          deletedAt: toDateString(data.deletedAt),
          retainedUntil: toDateString(data.retainedUntil),
        };
      });
      if (options.userId && !options.isOwnerOrAdmin) {
        list = list.filter((m) => m.userId === options.userId);
      }
      if (options.chatId) list = list.filter((m) => m.chatId === options.chatId);
      if (options.fromMe !== undefined) list = list.filter((m) => m.fromMe === options.fromMe);
      if (options.search) {
        const q = options.search.toLowerCase();
        list = list.filter(
          (m) =>
            m.senderNumber.toLowerCase().includes(q) ||
            (m.body || '').toLowerCase().includes(q) ||
            m.chatId.toLowerCase().includes(q)
        );
      }
      list.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
      const total = list.length;
      const page = Math.max(1, options.page || 1);
      const pageSize = Math.min(100, Math.max(1, options.pageSize || 25));
      const start = (page - 1) * pageSize;
      return { messages: list.slice(start, start + pageSize), total };
    });
  },

  async deleteDeletedMessage(id: string, currentUserId?: string, isOwnerOrAdmin?: boolean): Promise<boolean> {
    return withRetry(async () => {
      const doc = await deletedMessagesCol().doc(id).get();
      if (!doc.exists) return false;
      const data = doc.data() as Omit<DeletedMessage, 'id'>;
      if (!isOwnerOrAdmin && currentUserId && data.userId && data.userId !== currentUserId) {
        return false;
      }
      await deletedMessagesCol().doc(id).delete();
      return true;
    });
  },

  async deleteExpiredDeletedMessages(): Promise<number> {
    return withRetry(async () => {
      const now = nowIso();
      const snap = await deletedMessagesCol().where('retainedUntil', '<=', now).get();
      let deleted = 0;
      for (const doc of snap.docs) {
        await deletedMessagesCol().doc(doc.id).delete();
        deleted++;
      }
      return deleted;
    });
  },

  // ---------- Message Templates ----------
  async createTemplate(data: { userId: string; name: string; message: string; type?: 'SCHEDULED' | 'BIRTHDAY' }): Promise<Template> {
    return withRetry(async () => {
      const now = nowIso();
      const ref = templatesCol().doc();
      const record: Template = {
        id: ref.id,
        userId: data.userId,
        name: data.name,
        message: data.message,
        type: data.type || 'SCHEDULED',
        createdAt: now,
        updatedAt: now,
      };
      await ref.set(record);
      return record;
    });
  },

  async listTemplates(userId?: string, isOwnerOrAdmin?: boolean): Promise<Template[]> {
    return withRetry(async () => {
      const snap = await templatesCol().get();
      let list = snap.docs.map((doc) => {
        const data = doc.data() as Omit<Template, 'id'>;
        return { ...data, id: doc.id, createdAt: toDateString(data.createdAt), updatedAt: toDateString(data.updatedAt) };
      });
      if (userId && !isOwnerOrAdmin) {
        list = list.filter((t) => t.userId === userId);
      }
      return list.sort((a, b) => a.name.localeCompare(b.name));
    });
  },

  async getTemplate(id: string, currentUserId?: string, isOwnerOrAdmin?: boolean): Promise<Template | null> {
    return withRetry(async () => {
      const doc = await templatesCol().doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data() as Omit<Template, 'id'>;
      const record = { ...data, id: doc.id, createdAt: toDateString(data.createdAt), updatedAt: toDateString(data.updatedAt) };
      if (!isOwnerOrAdmin && currentUserId && record.userId !== currentUserId) return null;
      return record;
    });
  },

  async updateTemplate(
    id: string,
    data: { name?: string; message?: string; type?: 'SCHEDULED' | 'BIRTHDAY' },
    currentUserId?: string,
    isOwnerOrAdmin?: boolean
  ): Promise<Template | null> {
    return withRetry(async () => {
      const doc = templatesCol().doc(id);
      const current = await doc.get();
      if (!current.exists) return null;
      const existing = current.data() as Omit<Template, 'id'>;
      if (!isOwnerOrAdmin && currentUserId && existing.userId !== currentUserId) return null;
      const patch: Partial<Template> = { updatedAt: nowIso() };
      if (data.name !== undefined) patch.name = data.name;
      if (data.message !== undefined) patch.message = data.message;
      if (data.type !== undefined) patch.type = data.type;
      await doc.update(patch);
      const after = await doc.get();
      const afterData = after.data() as Omit<Template, 'id'>;
      return { ...afterData, id, createdAt: toDateString(afterData.createdAt), updatedAt: toDateString(afterData.updatedAt) };
    });
  },

  async deleteTemplate(id: string, currentUserId?: string, isOwnerOrAdmin?: boolean): Promise<boolean> {
    return withRetry(async () => {
      const doc = await templatesCol().doc(id).get();
      if (!doc.exists) return false;
      const data = doc.data() as Omit<Template, 'id'>;
      if (!isOwnerOrAdmin && currentUserId && data.userId !== currentUserId) return false;
      await templatesCol().doc(id).delete();
      return true;
    });
  },

  // ---------- Message History (privacy-gated) ----------
  async appendMessageHistory(userId: string | null, records: Array<Omit<MessageHistoryRecord, 'id' | 'userId'>>): Promise<number> {
    return withRetry(async () => {
      if (!records || records.length === 0) return 0;
      const batch = getDb().batch();
      let count = 0;
      for (const rec of records) {
        const ref = messageHistoryCol().doc();
        batch.set(ref, { ...rec, id: ref.id, userId: userId ?? null });
        count++;
      }
      await batch.commit();
      return count;
    });
  },

  async listMessageHistory(options: {
    userId?: string;
    isOwnerOrAdmin?: boolean;
    chatId?: string;
    senderNumber?: string;
    limit?: number;
    before?: string;
  }): Promise<MessageHistoryRecord[]> {
    return withRetry(async () => {
      const snap = await messageHistoryCol().orderBy('timestamp', 'desc').limit(200).get();
      let list = snap.docs.map((doc) => {
        const data = doc.data() as Omit<MessageHistoryRecord, 'id'>;
        return { ...data, id: doc.id, userId: data.userId ?? null, timestamp: toDateString(data.timestamp) };
      });
      if (options.userId && !options.isOwnerOrAdmin) {
        list = list.filter((m) => m.userId === options.userId);
      }
      if (options.chatId) list = list.filter((m) => m.chatId === options.chatId);
      if (options.senderNumber) list = list.filter((m) => m.senderNumber === options.senderNumber);
      const before = options.before;
      if (before) list = list.filter((m) => m.timestamp < before);
      return list.slice(0, Math.min(200, options.limit || 50));
    });
  },

  async pruneMessageHistory(olderThanIso: string, keepNewest: number): Promise<number> {
    return withRetry(async () => {
      const snap = await messageHistoryCol().get();
      const docs = snap.docs
        .map((doc) => ({ doc, ts: toDateString((doc.data() as any)?.timestamp) }))
        .sort((a, b) => b.ts.localeCompare(a.ts));
      let deleted = 0;
      for (let i = 0; i < docs.length; i++) {
        if (i < keepNewest) continue;
        if (docs[i].ts < olderThanIso) {
          await messageHistoryCol().doc(docs[i].doc.id).delete();
          deleted++;
        }
      }
      return deleted;
    });
  },

  // ---------- Health ----------
  async ping(): Promise<void> {
    return withRetry(async () => {
      await users().count().get();
    });
  },
};

export * from './schedule-utils';
export * from './payment-utils';

