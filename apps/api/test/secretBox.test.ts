import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, parseKey } from '../src/auth/secretBox.js';

describe('secretBox', () => {
  const key = randomBytes(32);

  it('round-trips and fits the VARBINARY(255) column', () => {
    const secret = randomBytes(20);
    const blob = encryptSecret(secret, key);
    expect(blob.length).toBeLessThanOrEqual(255);
    expect(decryptSecret(blob, key)).toEqual(secret);
  });

  it('uses a fresh IV each time', () => {
    const secret = randomBytes(20);
    expect(encryptSecret(secret, key)).not.toEqual(encryptSecret(secret, key));
  });

  it('fails with the wrong key or tampered data', () => {
    const blob = encryptSecret(randomBytes(20), key);
    expect(() => decryptSecret(blob, randomBytes(32))).toThrow();
    blob[blob.length - 1]! ^= 1;
    expect(() => decryptSecret(blob, key)).toThrow();
  });

  it('only accepts a 32-byte key', () => {
    expect(parseKey(randomBytes(32).toString('base64'))).toHaveLength(32);
    expect(() => parseKey(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
  });
});
