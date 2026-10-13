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
  // Unset → Secure in production only.
  COOKIE_SECURE: z.stringbool().optional(),
  // Comma-separated browser origins allowed to call the API, e.g. the Expo web dev server.
  CORS_ORIGINS: z.string().default(''),
  // Notion sync (brief 020): the ledger and year whose expenses go to the Budget tables; both or neither.
  NOTION_LEDGER_ID: z.coerce.number().int().positive().optional(),
  NOTION_YEAR: z.coerce.number().int().min(2000).max(2100).optional(),
});

/** Which ledger and year sync to the Notion Budget tables (brief 020). */
export interface NotionScope {
  ledgerId: number;
  year: number;
}

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
  /** Null when Notion sync isn't set up. */
  notion: NotionScope | null;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const env = Env.parse(source);
  if ((env.NOTION_LEDGER_ID === undefined) !== (env.NOTION_YEAR === undefined)) {
    throw new Error('set NOTION_LEDGER_ID and NOTION_YEAR together');
  }
  return {
    env: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    totpKey: parseKey(env.TOTP_ENC_KEY),
    sessionTtlMinutes: env.SESSION_TTL_MINUTES,
    cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    notion:
      env.NOTION_LEDGER_ID !== undefined && env.NOTION_YEAR !== undefined
        ? { ledgerId: env.NOTION_LEDGER_ID, year: env.NOTION_YEAR }
        : null,
  };
}
