const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOOPBACK_PORT = /^(http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])):\d+(?=[/?]|$)/;

function parse(uri: string): URL | null {
  return URL.canParse(uri) ? new URL(uri) : null;
}

export function isLoopback(uri: string): boolean {
  const url = parse(uri);
  return url !== null && url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

/** `https://` anywhere, or `http://` on this machine for a local client. Never a fragment or a user name. */
export function isAllowedRedirectUri(uri: string): boolean {
  const url = parse(uri);
  if (!url || uri.includes('#') || url.username || url.password) return false;
  return url.protocol === 'https:' || isLoopback(uri);
}

/** Exact, except that a loopback port is ignored: local clients pick a free one each run (RFC 8252 §7.3). */
export function redirectMatches(registered: string[], requested: string): boolean {
  if (!parse(requested)) return false;
  const withoutPort = (uri: string) => uri.replace(LOOPBACK_PORT, '$1');
  return registered.some((uri) => uri === requested || withoutPort(uri) === withoutPort(requested));
}
