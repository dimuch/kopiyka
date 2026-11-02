import type { PoolConnection } from 'mysql2/promise';
import type { Db } from '../db.js';

/**
 * Adds a user to a ledger as a member. An existing membership throws ER_DUP_ENTRY (the primary key); the caller
 * decides what that means. The admin script calls it for a new user today, and in-app invites (brief 052) will too.
 */
export async function addMember(q: Db | PoolConnection, ledgerId: number, userId: number): Promise<void> {
  await q.query("INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (?, ?, 'member')", [ledgerId, userId]);
}
