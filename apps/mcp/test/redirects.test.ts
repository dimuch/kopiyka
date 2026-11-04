import { describe, expect, it } from 'vitest';
import { isAllowedRedirectUri, redirectForLog, redirectMatches } from '../src/oauth/redirects.js';

describe('isAllowedRedirectUri', () => {
  const claude = 'https://claude.ai/api/mcp/auth_callback';
  const defaults = [claude, 'https://claude.com/api/mcp/auth_callback'];

  it.each(defaults)('allows the listed %s', (uri) => {
    expect(isAllowedRedirectUri(uri, defaults)).toBe(true);
  });

  it.each([
    'https://evil.example/cb',
    'https://sub.claude.ai/api/mcp/auth_callback',
    'https://claude.ai.evil.example/api/mcp/auth_callback',
    'https://claude.ai./api/mcp/auth_callback',
    'https://evil.example\\@claude.ai/cb',
    'https://сlaude.ai/api/mcp/auth_callback', // the first letter is Cyrillic
    'https://claude.ai:443/api/mcp/auth_callback',
    'http://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/api/mcp/auth_callback/',
    'https://CLAUDE.ai/api/mcp/auth_callback',
    'https://claude.ai/other',
    'https://claude.ai/api/mcp/auth_callback?x=1',
    'http://example.com/cb',
    'javascript:alert(1)',
    'data:text/html,hi',
    'not a url',
    '',
  ])('refuses %j, which isn’t on the list', (uri) => {
    expect(isAllowedRedirectUri(uri, defaults)).toBe(false);
  });

  // On the list here, so that each is refused by its own check, not for being unlisted.
  it.each([
    'https://a.example/cb#fragment',
    'https://a.example/cb#',
    'https://user:pass@a.example/',
    'https://user@a.example/',
    'https://:pass@a.example/',
  ])('refuses %j even when listed', (uri) => {
    expect(isAllowedRedirectUri(uri, [uri])).toBe(false);
  });

  it.each(['http://localhost:3118/callback', 'http://127.0.0.1/callback', 'http://[::1]:5000/callback'])(
    'allows the loopback %s with an empty list',
    (uri) => {
      expect(isAllowedRedirectUri(uri, [])).toBe(true);
    },
  );

  it.each([
    'http://localhost:80@evil.example/cb',
    'http://evil.example\\@localhost/cb',
    'http://localhost.evil/cb',
    'http://[::ffff:127.0.0.1]/cb',
    'http://localhost:99999/cb',
    'ftp://localhost/cb',
    'https://localhost/cb',
  ])('refuses %j, which only looks like loopback', (uri) => {
    expect(isAllowedRedirectUri(uri, [])).toBe(false);
  });
});

describe('redirectForLog', () => {
  it.each([
    ['https://a.example/cb?secret=1', 'https://a.example/cb'],
    ['https://user:pass@a.example/cb', 'https://a.example/cb'],
    ['data:text/html,<h1>hi</h1>', 'data:'],
    ['not a url', 'unparseable'],
  ])('logs %j as %s', (uri, logged) => {
    expect(redirectForLog(uri)).toBe(logged);
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
    ['a port that can’t exist', 'http://localhost:99999/callback'],
    ['a user name made to look like the host', 'http://localhost:80@evil.example/callback'],
  ])('still refuses %s on loopback', (_case, uri) => {
    expect(redirectMatches(['http://localhost:5000/callback'], uri)).toBe(false);
  });

  it('ignores the port on loopback only', () => {
    expect(redirectMatches(['https://a.example:5000/cb'], 'https://a.example:3118/cb')).toBe(false);
  });
});
