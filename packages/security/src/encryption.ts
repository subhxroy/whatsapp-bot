import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

export function getEncryptionKey(customKey?: string): Buffer {
  const keyHex = customKey || process.env.SESSION_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('CRITICAL SECURITY FAILURE: SESSION_ENCRYPTION_KEY environment variable is not defined.');
  }

  if (keyHex.length !== 64) {
    throw new Error('CRITICAL SECURITY FAILURE: SESSION_ENCRYPTION_KEY must be exactly a 64-character hex string (32 bytes).');
  }

  return Buffer.from(keyHex, 'hex');
}

export function encryptData(plaintext: string | Buffer, customKey?: string): string {
  const key = getEncryptionKey(customKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const inputBuffer = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const encrypted = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Return base64 payload: iv (12) + authTag (16) + encrypted
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

export function decryptData(ciphertextBase64: string, customKey?: string): string {
  const key = getEncryptionKey(customKey);
  const combined = Buffer.from(ciphertextBase64, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Decryption failed: Ciphertext is corrupted or too short.');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedText = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString('utf8');
}
