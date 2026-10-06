import { runMigrations } from '../src/migrate.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (copy apps/api/.env.example to apps/api/.env)');
  process.exit(1);
}

const ran = await runMigrations(url);
console.log(ran.length ? `Applied: ${ran.join(', ')}` : 'Database is up to date.');
