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
