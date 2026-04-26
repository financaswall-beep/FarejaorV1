import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(HERE, '..', '..', '..', 'db', 'migrations');

export interface IntegrationDb {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  connectionString: string;
}

export async function startPostgres(): Promise<IntegrationDb> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('farejador_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const connectionString = container.getConnectionUri();
  const pool = new Pool({ connectionString, max: 5 });

  await applyMigrations(pool);

  return { container, pool, connectionString };
}

export async function stopPostgres(db: IntegrationDb): Promise<void> {
  await db.pool.end();
  await db.container.stop();
}

async function applyMigrations(pool: Pool): Promise<void> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
      await client.query(sql);
    }
  } finally {
    client.release();
  }
}
