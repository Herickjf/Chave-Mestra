import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { Config } from '../config.js';

export function createPool(config: Config) {
  return new pg.Pool({ connectionString: config.DATABASE_URL });
}

export async function migrate(pool: pg.Pool) {
  const directory = fileURLToPath(new URL('./migrations/', import.meta.url));
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('vaultzero/migrate'))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const files = (await readdir(directory)).filter(file => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
    for (const file of files) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [file]);
      if (applied.rowCount) continue;
      const sql = await readFile(fileURLToPath(new URL(`./migrations/${file}`, import.meta.url)), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('vaultzero/migrate'))");
    client.release();
  }
}
