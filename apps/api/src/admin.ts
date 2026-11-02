import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { encryptSecret } from './auth/secretBox.js';
import { generateSecret, otpauthUri } from './auth/totp.js';
import { kyivToday } from './dates.js';
import { type Db, withTransaction } from './db.js';
import { DEFAULT_CATEGORIES } from './defaultCategories.js';
import { addMember } from './ledgers/members.js';

export interface CreatedUser {
  userId: number;
  ledgerId: number;
  otpauthUri: string;
}

/**
 * Creates a user with a fresh TOTP secret and their own ledger seeded with the
 * default categories in the month it's created (Kyiv time). Only the local admin script calls this; the API has no
 * signup. `createUserJoiningLedger` below is the script's `--join` path.
 */
export async function createUserWithLedger(
  db: Db,
  totpKey: Buffer,
  input: { username: string; email: string; ledgerName: string },
  now: Date,
): Promise<CreatedUser> {
  const secret = generateSecret();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [user] = await conn.query<ResultSetHeader>(
      'INSERT INTO users (username, email, totp_secret_enc) VALUES (?, ?, ?)',
      [input.username, input.email, encryptSecret(secret, totpKey)],
    );
    const userId = user.insertId;
    const [ledger] = await conn.query<ResultSetHeader>('INSERT INTO ledgers (name, owner_user_id) VALUES (?, ?)', [
      input.ledgerName,
      userId,
    ]);
    const ledgerId = ledger.insertId;
    await conn.query("INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (?, ?, 'owner')", [
      ledgerId,
      userId,
    ]);
    await conn.query('INSERT INTO categories (ledger_id, tech_name, display_name, sort_order) VALUES ?', [
      DEFAULT_CATEGORIES.map((c, i) => [ledgerId, c.techName, c.displayName, (i + 1) * 10]),
    ]);
    // The ledger's first month has a budget; other months are set up later (brief 033).
    await conn.query(
      `INSERT INTO category_months (category_id, list_month, display_name)
       SELECT category_id, ?, display_name FROM categories WHERE ledger_id = ?`,
      [`${kyivToday(now).slice(0, 7)}-01`, ledgerId],
    );
    await conn.commit();
    return { userId, ledgerId, otpauthUri: otpauthUri(input.username, secret) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export type JoinError = 'no_such_user' | 'owns_no_ledger' | 'owns_several_ledgers';

/**
 * Creates a user with a fresh TOTP secret as a member of the one ledger `input.join` owns, seeding nothing: that
 * ledger already has its categories. Refuses, writing nothing, when that user doesn't exist or owns no ledger or
 * several (it doesn't guess which). Only the local admin script calls this.
 */
export async function createUserJoiningLedger(
  db: Db,
  totpKey: Buffer,
  input: { username: string; email: string; join: string },
): Promise<CreatedUser | { error: JoinError }> {
  const secret = generateSecret();
  return withTransaction(db, async (conn) => {
    const [owned] = await conn.query<RowDataPacket[]>(
      `SELECT l.ledger_id FROM users u LEFT JOIN ledgers l ON l.owner_user_id = u.user_id WHERE u.username = ?`,
      [input.join],
    );
    if (owned.length === 0) return { error: 'no_such_user' as const };
    if (owned.length > 1) return { error: 'owns_several_ledgers' as const };
    const ledgerId: number | null = owned[0]!.ledger_id;
    if (ledgerId === null) return { error: 'owns_no_ledger' as const };

    const [user] = await conn.query<ResultSetHeader>(
      'INSERT INTO users (username, email, totp_secret_enc) VALUES (?, ?, ?)',
      [input.username, input.email, encryptSecret(secret, totpKey)],
    );
    await addMember(conn, ledgerId, user.insertId);
    return { userId: user.insertId, ledgerId, otpauthUri: otpauthUri(input.username, secret) };
  });
}
