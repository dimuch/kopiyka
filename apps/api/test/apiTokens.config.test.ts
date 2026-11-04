import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig: API tokens', () => {
  const base = { DATABASE_URL: 'mysql://u:p@127.0.0.1/db', TOTP_ENC_KEY: randomBytes(32).toString('base64') };

  it('leaves API tokens off unless MCP_ENABLED is true', () => {
    expect(loadConfig(base).apiTokens).toBeUndefined();
    expect(loadConfig({ ...base, MCP_ENABLED: 'false' }).apiTokens).toBeUndefined();
    expect(loadConfig({ ...base, API_TOKEN_TTL_MINUTES: '90' }).apiTokens).toBeUndefined();
  });

  it('gives tokens an hour by default, or API_TOKEN_TTL_MINUTES', () => {
    expect(loadConfig({ ...base, MCP_ENABLED: 'true' }).apiTokens).toEqual({ ttlMinutes: 60 });
    expect(loadConfig({ ...base, MCP_ENABLED: 'true', API_TOKEN_TTL_MINUTES: '90' }).apiTokens).toEqual({
      ttlMinutes: 90,
    });
  });

  it.each(['0', '-1', 'x'])('refuses API_TOKEN_TTL_MINUTES=%s', (ttl) => {
    expect(() => loadConfig({ ...base, MCP_ENABLED: 'true', API_TOKEN_TTL_MINUTES: ttl })).toThrow();
  });

  it('refuses an MCP_ENABLED that is not a boolean', () => {
    expect(() => loadConfig({ ...base, MCP_ENABLED: 'maybe' })).toThrow();
  });
});
