import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { offlineRates, testConfig } from './helpers.js';

// No queries run, so the pool never connects.
async function appWith(corsOrigins: string[]) {
  const db = createDb('mysql://nobody@127.0.0.1:1/none');
  const app = await buildApp({
    config: { ...testConfig(), corsOrigins },
    db,
    now: () => new Date(),
    fetchRate: offlineRates,
  });
  return { app, close: async () => (await app.close(), await db.end()) };
}

const preflight = (origin: string, method = 'POST') => ({
  method: 'OPTIONS' as const,
  url: '/api/auth/login',
  headers: { origin, 'access-control-request-method': method },
});

describe('CORS', () => {
  it('lets a configured origin call with cookies', async () => {
    const { app, close } = await appWith(['http://localhost:8081']);
    const res = await app.inject(preflight('http://localhost:8081'));
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(
      (await app.inject(preflight('https://evil.example'))).headers['access-control-allow-origin'],
    ).toBeUndefined();
    await close();
  });

  it('allows PUT and DELETE for editing and deleting expenses', async () => {
    const { app, close } = await appWith(['http://localhost:8081']);
    for (const method of ['PUT', 'DELETE']) {
      const allowed = (await app.inject(preflight('http://localhost:8081', method))).headers[
        'access-control-allow-methods'
      ];
      expect(
        String(allowed)
          .split(',')
          .map((m) => m.trim()),
      ).toContain(method);
    }
    await close();
  });

  it('sends no CORS headers when no origin is configured', async () => {
    const { app, close } = await appWith([]);
    const res = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'http://localhost:8081' } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await close();
  });
});
