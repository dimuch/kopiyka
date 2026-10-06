import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import mysql from 'mysql2/promise';
import { createUserWithLedger } from '../src/admin.js';
import { base32Decode, hotp, timeStep } from '../src/auth/totp.js';
import type { Config } from '../src/config.js';
import type { Db } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';
import type { RateFetcher } from '../src/rates/nbu.js';

export const TEST_DB_URL = process.env.DATABASE_URL_TEST;

/** Default rate lookup for tests: never touches the network. */
export const offlineRates: RateFetcher = async () => {
  throw new Error('NBU is not reachable in tests');
};

export async function testDbReachable(): Promise<boolean> {
  if (!TEST_DB_URL) return false;
  try {
    const conn = await mysql.createConnection({ uri: TEST_DB_URL, connectTimeout: 1000 });
    await conn.end();
    return true;
  } catch {
    return false;
  }
}

export function testConfig(totpKey = randomBytes(32)): Config {
  return {
    env: 'test',
    host: '127.0.0.1',
    port: 0,
    logLevel: 'silent',
    databaseUrl: TEST_DB_URL!,
    totpKey,
    sessionTtlMinutes: 30,
    cookieSecure: false,
    corsOrigins: [],
  };
}

/** Drops every table in the test database and runs all migrations. */
export async function resetSchema(): Promise<void> {
  const conn = await mysql.createConnection({ uri: TEST_DB_URL!, multipleStatements: true });
  const [tables] = await conn.query<mysql.RowDataPacket[]>('SHOW TABLES');
  const names = tables.map((t) => Object.values(t)[0] as string);
  if (names.length) {
    await conn.query(
      `SET FOREIGN_KEY_CHECKS = 0; DROP TABLE ${names.map((n) => `\`${n}\``).join(', ')}; SET FOREIGN_KEY_CHECKS = 1;`,
    );
  }
  await conn.end();
  await runMigrations(TEST_DB_URL!);
}

const DATA_TABLES = [
  'exchange_rates',
  'category_budgets',
  'expenses',
  'categories',
  'ledger_invites',
  'ledger_members',
  'ledgers',
  'sessions',
  'login_throttle',
  'users',
];

export async function clearData(db: Db): Promise<void> {
  const conn = await db.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of DATA_TABLES) await conn.query(`DELETE FROM ${t}`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
}

export interface TestUser {
  userId: number;
  ledgerId: number;
  username: string;
  secret: Buffer;
}

export async function makeUser(db: Db, config: Config, username: string): Promise<TestUser> {
  const created = await createUserWithLedger(db, config.totpKey, {
    username,
    email: `${username}@example.com`,
    ledgerName: 'Home',
  });
  const secret = base32Decode(new URL(created.otpauthUri).searchParams.get('secret')!);
  return { userId: created.userId, ledgerId: created.ledgerId, username, secret };
}

/** Logs in as a native client and returns the bearer header for later requests. */
export async function authHeader(
  app: FastifyInstance,
  user: TestUser,
  now: Date,
): Promise<{ authorization: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: user.username, code: hotp(user.secret, timeStep(now.getTime())), client: 'native' },
  });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  return { authorization: `Bearer ${res.json().token}` };
}
