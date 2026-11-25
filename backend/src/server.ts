import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { migrate } from './db/migrate.js';

// Configuração e migrações devem estar prontas antes de aceitar requisições.
const config = loadConfig();
const pool = createPool(config);
await migrate(pool);
const app = await createApp(config, pool);
const server = app.listen(config.PORT, () => {
  process.stdout.write(`VaultZero API listening on ${config.PORT}\n`);
});

const shutdown = () => {
  server.close(() => {
    void pool.end();
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
