import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const config: Config = {
  env: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'silent',
  publicUrl: 'https://kopiyka.example',
  apiUrl: 'http://api.test',
  sealKey: randomBytes(32),
};

describe('buildApp', () => {
  it('answers an unknown path with the { error } shape', async () => {
    const app = await buildApp({ config, now: () => new Date(), fetch });

    const res = await app.inject({ url: '/nothing-here', headers: { host: 'kopiyka.example' } });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
    await app.close();
  });
});
