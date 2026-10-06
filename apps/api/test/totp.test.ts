import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, hotp, otpauthUri, timeStep, verifyTotp } from '../src/auth/totp.js';

const RFC_SECRET = Buffer.from('12345678901234567890');

describe('base32', () => {
  it('encodes the RFC 6238 secret', () => {
    expect(base32Encode(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('round-trips arbitrary bytes', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 255, 7]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('ignores case, spaces and padding', () => {
    expect(base32Decode('gezd gnbv====')).toEqual(base32Decode('GEZDGNBV'));
  });
});

describe('hotp / totp', () => {
  // RFC 6238 appendix B, SHA-1, 8 digits.
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ])('matches the RFC vector at T=%i', (seconds, expected) => {
    expect(hotp(RFC_SECRET, timeStep(seconds * 1000), 8)).toBe(expected);
  });

  const now = 1_791_312_000_000;
  const step = timeStep(now);
  const codeAt = (s: number) => hotp(RFC_SECRET, s);

  it('accepts the current code and one step either side', () => {
    expect(verifyTotp(RFC_SECRET, codeAt(step), now, 0)).toBe(step);
    expect(verifyTotp(RFC_SECRET, codeAt(step - 1), now, 0)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, codeAt(step + 1), now, 0)).toBe(step + 1);
  });

  it('rejects codes two steps away', () => {
    expect(verifyTotp(RFC_SECRET, codeAt(step - 2), now, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, codeAt(step + 2), now, 0)).toBeNull();
  });

  it('rejects a code whose step was already used', () => {
    expect(verifyTotp(RFC_SECRET, codeAt(step), now, step)).toBeNull();
    expect(verifyTotp(RFC_SECRET, codeAt(step - 1), now, step - 1)).toBeNull();
  });

  it('rejects anything that is not 6 digits', () => {
    expect(verifyTotp(RFC_SECRET, '12345', now, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abcdef', now, 0)).toBeNull();
  });
});

describe('otpauthUri', () => {
  it('builds a Google Authenticator URI', () => {
    const uri = new URL(otpauthUri('ivanka', RFC_SECRET));
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.host).toBe('totp');
    expect(decodeURIComponent(uri.pathname)).toBe('/Kopiyka:ivanka');
    expect(uri.searchParams.get('secret')).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(uri.searchParams.get('issuer')).toBe('Kopiyka');
  });
});
