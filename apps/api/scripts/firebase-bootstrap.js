#!/usr/bin/env node
/*
 * Firebase Firestore bootstrap.
 * Verifies the Admin SDK service account works and eagerly creates the
 * collections the bot uses (Firestore auto-creates collections on first
 * document write, so we write + delete a placeholder in each).
 *
 * Usage: pnpm --filter @private-md-bot/api firebase:setup
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const COLLECTIONS = ['users', 'sessions', 'settings', 'commandConfigs', 'autoReplies', 'auditLogs'];

function loadDotenv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function main() {
  const env = { ...process.env, ...loadDotenv(path.join(REPO_ROOT, '.env')) };

  let account;
  if (env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      console.error('✗ FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON.');
      process.exit(1);
    }
  } else {
    const file = env.FIREBASE_SERVICE_ACCOUNT_PATH || env.GOOGLE_APPLICATION_CREDENTIALS;
    const resolved = file ? path.resolve(REPO_ROOT, file) : null;
    if (!resolved || !fs.existsSync(resolved)) {
      console.error(`✗ No Firebase service account found.
Expected one of:
  FIREBASE_SERVICE_ACCOUNT        (inline JSON)
  FIREBASE_SERVICE_ACCOUNT_PATH   (file, relative to repo root — tried "${resolved ?? '""'}")
  GOOGLE_APPLICATION_CREDENTIALS  (file)
Add the key file to ${path.join(REPO_ROOT, 'firebase-service-account.json')} and set
FIREBASE_SERVICE_ACCOUNT_PATH in .env`);
      process.exit(1);
    }
    try {
      account = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    } catch {
      console.error(`✗ Service account file "${resolved}" is not valid JSON.`);
      process.exit(1);
    }
  }

  console.log(`✓ Service account loaded for project: ${account.project_id}`);

  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');

  const app = initializeApp({ credential: cert(account) });
  const db = getFirestore(app);

  if (env.FIRESTORE_EMULATOR_HOST) {
    db.settings({ host: env.FIRESTORE_EMULATOR_HOST, ssl: false });
  }

  console.log('✓ Connected to Firestore');

  let ok = 0;
  for (const name of COLLECTIONS) {
    try {
      const doc = db.collection(name).doc('_init_');
      await doc.set({ _initialized: true, at: new Date().toISOString() });
      await doc.get();
      await doc.delete();
      console.log(`  ✓ ${name}`);
      ok += 1;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }

  console.log(`\n${ok}/${COLLECTIONS.length} collections verified.`);
  await app.delete();
  if (ok !== COLLECTIONS.length) process.exit(1);
}

main().catch((err) => {
  console.error('Bootstrap failed:', err.message);
  process.exit(1);
});
