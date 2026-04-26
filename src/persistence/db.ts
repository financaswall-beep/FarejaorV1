import { Pool } from 'pg';
import { env } from '../shared/config/env.js';
import { logger } from '../shared/logger.js';

function shouldUseSsl(databaseUrl: string): boolean {
  return env.DATABASE_SSL || databaseUrl.includes('supabase.co') || databaseUrl.includes('supabase.com');
}

function buildSslConfig(databaseUrl: string): object | undefined {
  if (!shouldUseSsl(databaseUrl)) return undefined;

  if (env.DATABASE_CA_CERT) {
    // CA explícito via env — rejectUnauthorized:true valida o certificado.
    // Suporta \n literal (necessário quando o cert é armazenado em linha única no Coolify).
    const ca = env.DATABASE_CA_CERT.replace(/\\n/g, '\n');
    return { rejectUnauthorized: true, ca };
  }

  // Sem CA configurado: aceita a criptografia mas não valida o certificado.
  // Aceitável em dev/staging; em produção defina DATABASE_CA_CERT.
  if (env.FAREJADOR_ENV === 'prod') {
    logger.warn('DATABASE_CA_CERT não configurado — conexão SSL sem validação de certificado. Configurar antes de produção plena.');
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
