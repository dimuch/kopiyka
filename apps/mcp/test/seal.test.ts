import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { open, seal } from '../src/seal.js';

const key = randomBytes(32);
const EXP = Date.parse('2026-10-06T10:00:00Z');
const before = new Date(EXP - 1);

function withFlippedByte(text: string, index: number): string {
  const bytes = Buffer.from(text, 'base64url');
  bytes[index]! ^= 0xff;
  return bytes.toString('base64url');
}

describe('seal and open', () => {
  const sealed = seal(key, 'code', { user: 'reader' }, EXP);

  it('opens what it sealed, until a millisecond before exp', () => {
    expect(open(key, 'code', sealed, before)).toEqual({ user: 'reader' });
  });

  it('refuses it from exp on', () => {
    expect(open(key, 'code', sealed, new Date(EXP))).toBeNull();
  });

  it('refuses another type, so a sign-in value can’t pass as a code', () => {
    expect(open(key, 'client', sealed, before)).toBeNull();
  });

  it('refuses another key', () => {
    expect(open(randomBytes(32), 'code', sealed, before)).toBeNull();
  });

  it.each([
    ['in the iv', 0],
    ['in the tag', 12],
    ['in the ciphertext', 28],
  ])('refuses a flipped byte %s', (_where, index) => {
    expect(open(key, 'code', withFlippedByte(sealed, index), before)).toBeNull();
  });

  it.each(['', 'not base64!', 'c2hvcnQ'])('refuses %j', (text) => {
    expect(open(key, 'code', text, before)).toBeNull();
  });

  it('gives the same value a different text each time', () => {
    expect(seal(key, 'code', { user: 'reader' }, EXP)).not.toBe(sealed);
  });
});
