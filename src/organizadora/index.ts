/**
 * Entrypoint da Organizadora — dist/organizadora.js
 *
 * Roda como processo independente (mesma imagem Docker, entrypoint separado).
 * Topologia: docs/phase3-agent-architecture/14-topologia-de-execucao.md
 *
 * Usage:
 *   node dist/organizadora/index.js
 * ou via npm:
 *   ORGANIZADORA_ENABLED=true OPENAI_API_KEY=sk-... node dist/organizadora/index.js
 */

import { logger } from '../shared/logger.js';
import { pool } from '../persistence/db.js';
import { startOrganizadora } from './worker.js';

const stop = startOrganizadora();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'organizadora: shutdown requested');
  stop();
  await pool.end();
  logger.info('organizadora: pool closed, exiting');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'organizadora: unhandledRejection');
  process.exit(1);
});
