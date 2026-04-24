import { Pool } from 'pg';
import { env } from '../shared/config/env.js';
import { logger } from '../shared/logger.js';

function shouldUseSsl(databaseUrl: string): boolean {
  return env.DATABASE_SSL || databaseUrl.includes('supabase.co') || databaseUrl.includes('supabase.com');
}

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  ssl: shouldUseSsl(env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  logger.error({ err }, 'unexpected PostgreSQL pool error');
});
