import { AuthenticationCreds, AuthenticationState, SignalDataTypeMap, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { db, getDb } from '@private-md-bot/database';
import { encryptData, decryptData } from '@private-md-bot/security';

export async function hasSavedSession(sessionKey = 'default_session'): Promise<boolean> {
  try {
    const record = await db.getSession(`${sessionKey}_creds`);
    if (!record) return false;
    const decrypted = decryptData(record.encryptedData);
    const parsed = JSON.parse(decrypted, BufferJSON.reviver);
    return !!(parsed && (parsed.me || parsed.myJid));
  } catch {
    return false;
  }
}

export async function clearFirebaseAuthState(sessionKey = 'default_session'): Promise<void> {
  // SECURITY: delete ONLY the docs owned by this exact session key.
  // An exact `ownerSession == sessionKey` equality query prevents the prefix
  // collision where one session key is a prefix of another (e.g. usernames
  // `alice_1` and `alice_1_2`, or Google emails that share a prefix). A
  // `doc.id.startsWith(docKey)` scan would delete ANOTHER user's paired
  // WhatsApp session in that case.
  try {
    const ids = await db.listSessionsForOwner(sessionKey);
    if (ids.length === 0) return;
    const batch = getDb().batch();
    for (const id of ids) {
      batch.delete(getDb().collection('sessions').doc(id));
    }
    await batch.commit();
  } catch (err) {
    console.error('Error clearing session auth state:', err);
  }
}

export async function useFirebaseAuthState(sessionKey = 'default_session'): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const docKey = `${sessionKey}_`;

  const readData = async (key: string) => {
    try {
      const record = await db.getSession(`${docKey}${key}`);
      if (!record) return null;
      const decrypted = decryptData(record.encryptedData);
      return JSON.parse(decrypted, BufferJSON.reviver);
    } catch (err) {
      return null;
    }
  };

  const writeData = async (key: string, data: any) => {
    const jsonStr = JSON.stringify(data, BufferJSON.replacer);
    const encrypted = encryptData(jsonStr);
    await db.upsertSession(`${docKey}${key}`, encrypted, sessionKey);
  };

  const removeData = async (key: string) => {
    try {
      await db.deleteSession(`${docKey}${key}`);
    } catch {}
  };

  const credsData = await readData('creds');
  const creds: AuthenticationCreds = credsData || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: any } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = BufferJSON.reviver('', value);
              }
              if (value) {
                data[id] = value;
              }
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category as keyof SignalDataTypeMap]) {
              const value = data[category as keyof SignalDataTypeMap]![id];
              const key = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(key, value));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    },
  };
}
