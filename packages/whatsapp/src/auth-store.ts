import { AuthenticationCreds, AuthenticationState, SignalDataTypeMap, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { db, getDb } from '@private-md-bot/database';
import { encryptData, decryptData } from '@private-md-bot/security';

export async function clearFirebaseAuthState(sessionKey = 'default_session'): Promise<void> {
  const docKey = `${sessionKey}_`;
  try {
    const snap = await getDb().collection('sessions').get();
    if (snap.empty) return;
    const batch = getDb().batch();
    snap.docs.forEach((doc: any) => {
      if (doc.id.startsWith(docKey) || doc.id.includes(sessionKey)) {
        batch.delete(doc.ref);
      }
    });
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
    await db.upsertSession(`${docKey}${key}`, encrypted);
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
