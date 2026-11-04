import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await buildApp({ config, now: () => new Date(), fetch });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown());
}

async function shutdown(): Promise<void> {
  await app.close();
  process.exit(0);
}

await app.listen({ host: config.host, port: config.port });
