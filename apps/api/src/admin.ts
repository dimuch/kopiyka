import type { ResultSetHeader } from 'mysql2/promise';
import { encryptSecret } from './auth/secretBox.js';
import { generateSecret, otpauthUri } from './auth/totp.js';
import { kyivToday } from './dates.js';
import type { Db } from './db.js';
import { DEFAULT_CATEGORIES } from './defaultCategories.js';

export interface CreatedUser {
  userId: number;
  ledgerId: number;
  otpauthUri: string;
}

/**
 * Creates a user with a fresh TOTP secret and their own ledger seeded with the
 * default categories in the month it's created (Kyiv time). Only the local admin script calls this; the API has no
 * signup.
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
