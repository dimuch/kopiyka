import { describe, expect, it } from 'vitest';
import { isAllowedRedirectUri, redirectMatches } from '../src/oauth/redirects.js';

describe('isAllowedRedirectUri', () => {
  it.each([
    'https://claude.ai/api/mcp/auth_callback',
    'https://example.com/cb?x=1',
    'http://localhost:3118/callback',
    'http://127.0.0.1/callback',
    'http://[::1]:5000/callback',
  ])('allows %s', (uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(true);
  });

  it.each([
    'http://example.com/cb',
    'http://localhost.example.com/cb',
    'javascript:alert(1)',
    'data:text/html,hi',
    'https://a.example/cb#fragment',
    'https://a.example/cb#',
    'https://user:pass@a.example/',
    'https://user@a.example/',
    'not a url',
    '',
  ])('refuses %j', (uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(false);
  });
});

describe('redirectMatches', () => {
  const claude = 'https://claude.ai/api/mcp/auth_callback';

  it('takes the registered string as it is', () => {
    expect(redirectMatches([claude], claude)).toBe(true);
  });

  it.each([
    `${claude}/`,
    'https://claude.ai/api/mcp/auth_Callback',
    `${claude}?x=1`,
    'https://claude.ai:443/api/mcp/auth_callback',
  ])('refuses %s, even one character off', (uri) => {
    expect(redirectMatches([claude], uri)).toBe(false);
  });

  it('checks every registered URI', () => {
    expect(redirectMatches(['https://a.example/cb', claude], claude)).toBe(true);
  });

  it('ignores the port on loopback, which changes on every run of a local client', () => {
    expect(redirectMatches(['http://localhost:5000/callback'], 'http://localhost:3118/callback')).toBe(true);
    expect(redirectMatches(['http://localhost/callback'], 'http://localhost:3118/callback')).toBe(true);
    expect(redirectMatches(['http://[::1]:5000/callback'], 'http://[::1]:3118/callback')).toBe(true);
  });

  it.each([
    ['another path', 'http://localhost:3118/other'],
    ['another query', 'http://localhost:3118/callback?x=1'],
    ['another loopback host', 'http://127.0.0.1:3118/callback'],
    ['https', 'https://localhost:3118/callback'],
  ])('still refuses %s on loopback', (_case, uri) => {
    expect(redirectMatches(['http://localhost:5000/callback'], uri)).toBe(false);
  });

  it('ignores the port on loopback only', () => {
    expect(redirectMatches(['https://a.example:5000/cb'], 'https://a.example:3118/cb')).toBe(false);
  });
});
