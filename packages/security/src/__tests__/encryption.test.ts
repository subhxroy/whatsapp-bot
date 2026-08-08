import { describe, it, expect } from 'vitest';
import { encryptData, decryptData, getEncryptionKey } from '../encryption';

describe('Encryption Module (AES-256-GCM)', () => {
  const validKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('should successfully encrypt and decrypt data with valid 32-byte key', () => {
    const text = 'secret_whatsapp_session_token_data_12345';
    const encrypted = encryptData(text, validKey);
    expect(encrypted).not.toBe(text);

    const decrypted = decryptData(encrypted, validKey);
    expect(decrypted).toBe(text);
  });

  it('should fail securely when SESSION_ENCRYPTION_KEY is invalid length', () => {
    const invalidKey = 'short_key';
    expect(() => getEncryptionKey(invalidKey)).toThrow(/SESSION_ENCRYPTION_KEY must be exactly a 64-character hex string/);
  });

  it('should throw error when decrypting with corrupted ciphertext', () => {
    expect(() => decryptData('invalid_base64_payload', validKey)).toThrow();
  });
});
