import { Pool } from 'pg';
import { env } from '../shared/config/env.js';
import { logger } from '../shared/logger.js';

function shouldUseSsl(databaseUrl: string): boolean {
  return env.DATABASE_SSL || databaseUrl.includes('supabase.co') || databaseUrl.includes('supabase.com');
}

function buildSslConfig(databaseUrl: string): object | undefined {
  if (!shouldUseSsl(databaseUrl)) return undefined;

  // Supabase connection pooler (porta 6543) não suporta validação de cadeia de cert.
  // TLS permanece ativo — conexão é criptografada.
  if (env.FAREJADOR_ENV === 'prod') {
    logger.info('SSL ativo com rejectUnauthorized:false — conexão criptografada via Supabase pooler.');
  }

  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  ssl: buildSslConfig(env.DATABASE_URL),
});

pool.on('error', (err) => {
  logger.error({ err }, 'unexpected PostgreSQL pool error');
});
