import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { notionClient } from './notion/client.js';
import { nbuFetcher } from './rates/nbu.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
const notion = config.notionApi ? notionClient(config.notionApi) : null;
const app = await buildApp({
  config,
  db,
  now: () => new Date(),
  fetchRate: nbuFetcher(),
  notionGroceries: notion?.groceries,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown());
}

async function shutdown(): Promise<void> {
  await app.close();
  await db.end();
  process.exit(0);
}

await app.listen({ host: config.host, port: config.port });
