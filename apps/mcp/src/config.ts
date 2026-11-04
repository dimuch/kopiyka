import { z } from 'zod';

const KEY_BYTES = 32;

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3200),
  LOG_LEVEL: z.string().default('info'),
  // Where clients reach this server: an origin, because the OAuth URLs and the token audience are built from it.
  PUBLIC_URL: z.url().default('http://localhost:3200'),
  API_URL: z.url().default('http://127.0.0.1:3000'),
  MCP_SEAL_KEY: z.string().min(1),
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
  };
}
