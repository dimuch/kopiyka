import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// RFC 4226 (HOTP) / RFC 6238 (TOTP) with the Google Authenticator defaults:
// SHA-1, 6 digits, 30-second steps.

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;
export const ISSUER = 'Kopiyka';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(): Buffer {
  return randomBytes(20);
}

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function timeStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/**
 * Checks a 6-digit code against the current step ±`window` steps (clock drift).
 * Steps at or below `lastUsedStep` are rejected so a code works only once.
 * Returns the matched step, to be stored as the new `last_totp_step`, or null.
 */
export function verifyTotp(
  secret: Buffer,
  code: string,
  nowMs: number,
  lastUsedStep: number,
  window = 1,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const given = Buffer.from(code);
  const current = timeStep(nowMs);
  let matched: number | null = null;
  // Check every candidate so timing doesn't reveal which step matched.
  for (let step = current - window; step <= current + window; step++) {
    const ok = timingSafeEqual(Buffer.from(hotp(secret, step)), given);
    if (ok && step > lastUsedStep && matched === null) matched = step;
  }
  return matched;
}

export function otpauthUri(username: string, secret: Buffer): string {
  const label = encodeURIComponent(`${ISSUER}:${username}`);
  const params = new URLSearchParams({
    secret: base32Encode(secret),
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: '6',
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
