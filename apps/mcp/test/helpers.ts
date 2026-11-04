import { randomBytes } from 'node:crypto';
import type { Config } from '../src/config.js';

export const PUBLIC_URL = 'https://kopiyka.example';
export const HOST = 'kopiyka.example';

export const testConfig = (): Config => ({
  env: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'silent',
  publicUrl: PUBLIC_URL,
  apiUrl: 'http://api.test',
  sealKey: randomBytes(32),
});
