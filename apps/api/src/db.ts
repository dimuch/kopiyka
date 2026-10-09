import mysql from 'mysql2/promise';

export type Db = mysql.Pool;

export function createDb(databaseUrl: string): Db {
  return mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 10,
    // DATETIME columns hold UTC; DATE columns come back as 'YYYY-MM-DD' strings.
    timezone: 'Z',
    dateStrings: ['DATE'],
    decimalNumbers: false,
  });
}

/**
 * Runs `fn` in a transaction on one pooled connection: commits when it resolves, rolls back when it throws.
 * `fn` must use only `conn`: another pool query while this one holds row locks can wait on them or starve the pool.
 */
export async function withTransaction<T>(db: Db, fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
