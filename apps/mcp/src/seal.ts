import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** What a sealed value is for. It's inside the ciphertext, so one kind can't be replayed as another. */
export type SealType = 'client' | 'signin' | 'consent' | 'code' | 'access';

/** Base64url of iv | tag | ciphertext: this server keeps no storage, so its short-lived values travel sealed. */
export function seal(key: Buffer, typ: SealType, payload: object, expMs: number): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify({ typ, exp: expMs, payload });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

/** The sealed payload, or null if `text` is forged, damaged, expired or of another type. */
export function open<T extends object>(key: Buffer, typ: SealType, text: string, now: Date): T | null {
  const bytes = Buffer.from(text, 'base64url');
  if (bytes.length <= IV_BYTES + TAG_BYTES) return null;
  const decipher = createDecipheriv(ALGORITHM, key, bytes.subarray(0, IV_BYTES));
  try {
    decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const plaintext = Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
    const sealed = JSON.parse(plaintext.toString('utf8')) as { typ: SealType; exp: number; payload: T };
    return sealed.typ === typ && now.getTime() < sealed.exp ? sealed.payload : null;
  } catch {
    // Node reports a failed authentication by throwing; for a caller that's just a bad value.
    return null;
  }
}
