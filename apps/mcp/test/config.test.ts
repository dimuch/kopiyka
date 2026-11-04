import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const sealKey = randomBytes(32);
  const base = { MCP_SEAL_KEY: sealKey.toString('base64') };

  it('has working local defaults', () => {
    expect(loadConfig(base)).toEqual({
      env: 'development',
      host: '127.0.0.1',
      port: 3200,
      logLevel: 'info',
      publicUrl: 'http://localhost:3200',
      apiUrl: 'http://127.0.0.1:3000',
      sealKey,
    });
  });

  it('keeps PUBLIC_URL as a bare origin', () => {
    expect(loadConfig({ ...base, PUBLIC_URL: 'https://kopiyka.example/' }).publicUrl).toBe('https://kopiyka.example');
  });

  it('drops API_URL’s trailing slash, so paths join cleanly', () => {
    expect(loadConfig({ ...base, API_URL: 'http://127.0.0.1:3100/' }).apiUrl).toBe('http://127.0.0.1:3100');
  });

  it('needs https in production', () => {
    const production = { ...base, NODE_ENV: 'production' };

    expect(() => loadConfig({ ...production, PUBLIC_URL: 'http://kopiyka.example' })).toThrow(/https/);
    expect(loadConfig({ ...production, PUBLIC_URL: 'https://kopiyka.example' }).publicUrl).toBe(
      'https://kopiyka.example',
    );
  });

  it.each(['https://kopiyka.example/mcp', 'https://kopiyka.example?x=1', 'not a url'])(
    'refuses PUBLIC_URL=%s',
    (publicUrl) => {
      expect(() => loadConfig({ ...base, PUBLIC_URL: publicUrl })).toThrow();
    },
  );

  it('refuses a missing or short seal key', () => {
    expect(() => loadConfig({})).toThrow();
    expect(() => loadConfig({ MCP_SEAL_KEY: randomBytes(16).toString('base64') })).toThrow(/32 bytes/);
  });
});
