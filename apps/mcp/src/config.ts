import { z } from 'zod';

const KEY_BYTES = 32;

/** A code sent to this machine lands in the address bar, where it can be talked out of a user (plan, Revision 4). */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The hosted Claude callback. A URL belongs here only if its page removes the code from the address bar: `claude.com`'s
 * doesn't, so a stranger could talk the code out of a user there.
 */
const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3200),
  LOG_LEVEL: z.string().default('info'),
  // Where clients reach this server: an origin, because the OAuth URLs and the token audience are built from it.
  PUBLIC_URL: z.url().default('http://localhost:3200'),
  API_URL: z.url().default('http://127.0.0.1:3000'),
  MCP_SEAL_KEY: z.string().min(1),
  // The only redirects a client may register, exactly as it sends them. Blank means no app can connect.
  MCP_ALLOWED_REDIRECT_URIS: z.string().default(CLAUDE_CALLBACK),
});

export interface Config {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  /** No trailing slash. */
  publicUrl: string;
  /** No trailing slash. */
  apiUrl: string;
  sealKey: Buffer;
  allowedRedirectUris: string[];
}

function parsePublicUrl(value: string, env: Config['env']): string {
  const url = new URL(value);
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('PUBLIC_URL must be an origin, with no path');
  if (env === 'production' && url.protocol !== 'https:') throw new Error('PUBLIC_URL must be https in production');
  return url.origin;
}

function parseSealKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== KEY_BYTES) throw new Error(`MCP_SEAL_KEY must be ${KEY_BYTES} bytes, base64`);
  return key;
}

function parseAllowedRedirectUri(uri: string): string {
  const url = URL.canParse(uri) ? new URL(uri) : null;
  const exact = url?.protocol === 'https:' && url.href === uri && !/[#?]/.test(uri) && !url.username && !url.password;
  if (!exact || LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(`MCP_ALLOWED_REDIRECT_URIS: ${uri} must be an exact https URL on a public host, with no query`);
  }
  return uri;
}

function parseAllowedRedirectUris(value: string): string[] {
  if (!value.trim()) return [];
  return value.split(',').map((uri) => parseAllowedRedirectUri(uri.trim()));
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const env = Env.parse(source);
  return {
    env: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    publicUrl: parsePublicUrl(env.PUBLIC_URL, env.NODE_ENV),
    apiUrl: new URL(env.API_URL).origin,
    sealKey: parseSealKey(env.MCP_SEAL_KEY),
    allowedRedirectUris: parseAllowedRedirectUris(env.MCP_ALLOWED_REDIRECT_URIS),
  };
}
