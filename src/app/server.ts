import Fastify from 'fastify';
import { env } from '../shared/config/env.js';
import { logger, loggerOptions } from '../shared/logger.js';
import { pool } from '../persistence/db.js';
import { registerRoutes } from './routes.js';
import { startWorker } from '../normalization/worker.js';

const fastify = Fastify({
  logger: loggerOptions,
});

let stopWorker: (() => void) | null = null;

fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (_req, body, done) => {
    try {
      done(null, { raw: body, parsed: JSON.parse(body.toString()) });
    } catch (err) {
      done(err as Error);
    }
  },
);

async function start(): Promise<void> {
  await registerRoutes(fastify);

  stopWorker = startWorker();

  const port = env.PORT;
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info({ port }, 'server listening');
}

async function shutdown(signal: string): Promise<void> {
  fastify.log.info({ signal }, 'shutting down gracefully');
  stopWorker?.();
  await fastify.close();
  await pool.end();
  fastify.log.info('shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

start().catch((err) => {
  logger.error({ err }, 'failed to start server');
  process.exit(1);
});
