import Fastify from 'fastify';
import { env } from '../shared/config/env.js';
import { logger } from '../shared/logger.js';
import { pool } from '../persistence/db.js';
import { registerRoutes } from './routes.js';

const fastify = Fastify({
  logger: true,
});

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

  const port = env.PORT;
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Server listening on port ${port}`);
}

async function shutdown(signal: string): Promise<void> {
  fastify.log.info({ signal }, 'Shutting down gracefully');
  await fastify.close();
  await pool.end();
  fastify.log.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
