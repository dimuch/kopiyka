import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

// src/ under tsx, dist/src/ once built (the build copies migrations/ into dist/).
export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/** Applies every migrations/*.sql file not yet recorded in schema_migrations, in name order. */
export async function runMigrations(databaseUrl: string, dir = MIGRATIONS_DIR): Promise<string[]> {
  const conn = await mysql.createConnection({ uri: databaseUrl, multipleStatements: true, timezone: 'Z' });
  try {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version     VARCHAR(255) PRIMARY KEY,
         applied_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`,
    );
    const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version as string));
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

    const ran: string[] = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(dir, file), 'utf8');
      // MySQL DDL auto-commits, so a failed file can leave partial tables; fix forward.
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
      ran.push(file);
    }
    return ran;
  } finally {
    await conn.end();
  }
}
