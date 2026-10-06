import { z } from 'zod';
import { parseKey } from './auth/secretBox.js';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1),
  TOTP_ENC_KEY: z.string().min(1),
  SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.stringbool().default(false),
  // Comma-separated browser origins allowed to call the API, e.g. the Expo web dev server.
  CORS_ORIGINS: z.string().default(''),
});

export interface Config {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  databaseUrl: string;
  totpKey: Buffer;
  sessionTtlMinutes: number;
  cookieSecure: boolean;
  corsOrigins: string[];
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const env = Env.parse(source);
  return {
    env: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    totpKey: parseKey(env.TOTP_ENC_KEY),
    sessionTtlMinutes: env.SESSION_TTL_MINUTES,
    cookieSecure: env.COOKIE_SECURE,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}
