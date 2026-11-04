import { randomBytes } from 'node:crypto';
import type { Config } from '../src/config.js';

export const PUBLIC_URL = 'https://kopiyka.example';
export const HOST = 'kopiyka.example';

/** Only what the tests register successfully: `evil.example` stays off the list. */
export const LISTED_REDIRECTS = ['https://claude.ai/api/mcp/auth_callback', 'https://second.example/cb'];

export const testConfig = (): Config => ({
  env: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'silent',
  publicUrl: PUBLIC_URL,
  apiUrl: 'http://api.test',
  sealKey: randomBytes(32),
  allowedRedirectUris: LISTED_REDIRECTS,
});
