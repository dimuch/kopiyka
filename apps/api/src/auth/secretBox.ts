import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM. Stored layout: iv (12 bytes) | auth tag (16 bytes) | ciphertext.
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function parseKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32) {
    throw new Error('TOTP_ENC_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)');
  }
  return key;
}

export function encryptSecret(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptSecret(blob: Buffer, key: Buffer): Buffer {
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = blob.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
