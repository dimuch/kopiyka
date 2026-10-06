import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
const app = await buildApp({ config, db, now: () => new Date() });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close();
    await db.end();
    process.exit(0);
  });
}

await app.listen({ host: config.host, port: config.port });
