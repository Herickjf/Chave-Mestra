import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool, migrate } from './db/pool.js';

const config = loadConfig();
const pool = createPool(config);
await migrate(pool);
const app = await createApp(config, pool);
const server = app.listen(config.PORT, () => { process.stdout.write(`VaultZero API listening on ${config.PORT}\n`); });
const shutdown = () => { server.close(() => { void pool.end(); }); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
