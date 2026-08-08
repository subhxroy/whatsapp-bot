import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore, Timestamp } from 'firebase-admin/firestore';

export type MatchType = 'EXACT' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'REGEX';
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
  trigger: string;
  matchType: MatchType;
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

let cachedDb: Firestore | null = null;

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
      app = initializeApp({ credential: cert(JSON.parse(resolvedContent)) });
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

const users = () => collection('users');
const sessions = () => collection('sessions');
const settingsCol = () => collection('settings');
const commandConfigs = () => collection('commandConfigs');
const autoReplies = () => collection('autoReplies');
const auditLogs = () => collection('auditLogs');
const payments = () => collection('payments');

export const db = {
  // ---------- Users ----------
  async countUsers(): Promise<number> {
    const snap = await users().count().get();
    return snap.data().count;
  },

  async createUser(data: {
    username: string;
    passwordHash: string;
    role: string;
    googleUid?: string | null;
  }): Promise<User> {
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
  },

  async findUserByUsername(username: string): Promise<User | null> {
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
        role: data.role ?? 'OWNER',
        createdAt: toDateString(data.createdAt),
        updatedAt: toDateString(data.updatedAt),
      };
    }
    return null;
  },

  async findUserById(id: string): Promise<User | null> {
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
        role: data.role ?? 'OWNER',
        createdAt: toDateString(data.createdAt),
        updatedAt: toDateString(data.updatedAt),
      };
    }
    return null;
  },

  async setUserGoogleUid(username: string, googleUid: string): Promise<void> {
    await users().doc(username).set({ googleUid }, { merge: true });
  },

  // ---------- WhatsApp Sessions ----------
  async getSession(sessionKey: string): Promise<{ encryptedData: string; updatedAt: string } | null> {
    const doc = await sessions().doc(sessionKey).get();
    if (!doc.exists) return null;
    const data = doc.data() as { encryptedData: string; updatedAt?: string };
    return { encryptedData: data.encryptedData, updatedAt: toDateString(data.updatedAt) };
  },

  async upsertSession(sessionKey: string, encryptedData: string): Promise<void> {
    await sessions().doc(sessionKey).set(
      {
        sessionKey,
        encryptedData,
        updatedAt: nowIso(),
      },
      { merge: true }
    );
  },

  async deleteSession(sessionKey: string): Promise<void> {
    await sessions().doc(sessionKey).delete();
  },

  // ---------- Settings ----------
  async getSettings(): Promise<Setting[]> {
    const snap = await settingsCol().get();
    const items: Setting[] = snap.docs.map((doc) => {
      const data = doc.data() as Omit<Setting, 'id'>;
      return { ...data, id: doc.id, updatedAt: toDateString(data.updatedAt) };
    });
    return items.sort((a, b) => a.key.localeCompare(b.key));
  },

  async getSetting(key: string): Promise<Setting | null> {
    const doc = await settingsCol().doc(key).get();
    if (!doc.exists) return null;
    const data = doc.data() as Omit<Setting, 'id'>;
    return { ...data, id: doc.id, updatedAt: toDateString(data.updatedAt) };
  },

  async upsertSetting(data: { key: string; value: string; description?: string }): Promise<Setting> {
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
  },

  // ---------- Command Configs ----------
  async getCommandConfigs(): Promise<CommandConfig[]> {
    const snap = await commandConfigs().get();
    return snap.docs.map((doc) => {
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
  },

  // ---------- Auto Replies ----------
  privateSortAutoReplies(list: AutoReply[]): AutoReply[] {
    return list.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.createdAt.localeCompare(b.createdAt);
    });
  },

  async getAutoReplies(): Promise<AutoReply[]> {
    const snap = await autoReplies().get();
    const list: AutoReply[] = snap.docs.map((doc) => {
      const data = doc.data() as Omit<AutoReply, 'id'>;
      return { ...data, id: doc.id, createdAt: toDateString(data.createdAt), updatedAt: toDateString(data.updatedAt) };
    });
    return this.privateSortAutoReplies(list);
  },

  async getEnabledAutoReplies(): Promise<AutoReply[]> {
    const all = await this.getAutoReplies();
    return all.filter((r) => r.enabled);
  },

  async createAutoReply(data: {
    trigger: string;
    matchType: MatchType;
    response: string;
    enabled: boolean;
    priority: number;
    cooldown: number;
  }): Promise<AutoReply> {
    const now = nowIso();
    const ref = autoReplies().doc();
    const rule: AutoReply = {
      id: ref.id,
      trigger: data.trigger,
      matchType: data.matchType,
      response: data.response,
      enabled: data.enabled,
      priority: data.priority,
      cooldown: data.cooldown,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(rule);
    return rule;
  },

  async updateAutoReply(
    id: string,
    data: Partial<Omit<AutoReply, 'id' | 'createdAt'>>
  ): Promise<AutoReply | null> {
    const doc = await autoReplies().doc(id).get();
    if (!doc.exists) return null;
    const current = doc.data() as Omit<AutoReply, 'id'>;
    const updated: AutoReply = {
      ...current,
      ...data,
      id,
      createdAt: toDateString(current.createdAt),
      updatedAt: nowIso(),
    };
    await autoReplies().doc(id).set(updated);
    return updated;
  },

  async deleteAutoReply(id: string): Promise<void> {
    await autoReplies().doc(id).delete();
  },

  // ---------- Audit Logs ----------
  async getAuditLogs(params: { take: number; skip: number }): Promise<AuditLog[]> {
    const { take, skip } = params;
    const snap = await auditLogs().orderBy('createdAt', 'desc').offset(skip).limit(take).get();
    return snap.docs.map((doc) => {
      const data = doc.data() as Omit<AuditLog, 'id'>;
      return { ...data, id: doc.id, createdAt: toDateString(data.createdAt) };
    });
  },

  async countAuditLogs(): Promise<number> {
    const snap = await auditLogs().count().get();
    return snap.data().count;
  },

  async createAuditLog(data: {
    action: string;
    actor: string;
    details?: string | null;
    ipAddress?: string | null;
  }): Promise<AuditLog> {
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
  },

  // ---------- Payments ----------
  async createPaymentRequest(data: {
    userId: string;
    userEmail: string;
    utrNumber: string;
    amount: number;
  }): Promise<PaymentRequest> {
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
  },

  async getPaymentRequests(): Promise<PaymentRequest[]> {
    const snap = await payments().get();
    const list = snap.docs.map((doc) => {
      const data = doc.data() as Omit<PaymentRequest, 'id'>;
      return { ...data, id: doc.id, createdAt: toDateString(data.createdAt), updatedAt: toDateString(data.updatedAt) };
    });
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getUserPaymentStatus(userIdOrEmail: string): Promise<{
    isApproved: boolean;
    status: 'UNPAID' | 'PENDING' | 'APPROVED' | 'REJECTED';
    request?: PaymentRequest;
  }> {
    const EXEMPT_EMAILS = ['contact.subhroy@gmail.com', 'aarxslan@gmail.com', 'admin', 'admin@openify.studio'];
    if (EXEMPT_EMAILS.some((e) => e.toLowerCase() === userIdOrEmail.toLowerCase())) {
      return { isApproved: true, status: 'APPROVED' };
    }

    const snap = await payments().where('userId', '==', userIdOrEmail).get();
    if (snap.empty) {
      const snapEmail = await payments().where('userEmail', '==', userIdOrEmail).get();
      if (snapEmail.empty) {
        return { isApproved: false, status: 'UNPAID' };
      }
      const req = snapEmail.docs[0].data() as PaymentRequest;
      return { isApproved: req.status === 'APPROVED', status: req.status, request: req };
    }
    const req = snap.docs[0].data() as PaymentRequest;
    return { isApproved: req.status === 'APPROVED', status: req.status, request: req };
  },

  async updatePaymentStatus(paymentId: string, status: 'APPROVED' | 'REJECTED'): Promise<PaymentRequest | null> {
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
  },

  // ---------- Health ----------
  async ping(): Promise<void> {
    await users().count().get();
  },
};
