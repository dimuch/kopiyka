import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const base = { DATABASE_URL: 'mysql://u:p@127.0.0.1/db', TOTP_ENC_KEY: randomBytes(32).toString('base64') };

  it.each([
    ['production', undefined, true],
    ['production', 'false', false],
    ['development', undefined, false],
    ['development', 'true', true],
  ] as const)('NODE_ENV=%s, COOKIE_SECURE=%s → cookieSecure %s', (nodeEnv, cookieSecure, expected) => {
    const source = { ...base, NODE_ENV: nodeEnv, ...(cookieSecure ? { COOKIE_SECURE: cookieSecure } : {}) };
    expect(loadConfig(source).cookieSecure).toBe(expected);
  });
});
