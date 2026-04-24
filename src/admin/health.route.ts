import type { FastifyInstance } from 'fastify';
import { pool } from '../persistence/db.js';
import { env } from '../shared/config/env.js';
import { logger } from '../shared/logger.js';

export async function registerHealthRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/healthz', async (_request, reply) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), 2000);
    });

    try {
      await Promise.race([pool.query('SELECT 1'), timeoutPromise]);
      logger.info({ environment: env.FAREJADOR_ENV }, 'health check passed');
      return reply.status(200).send({ status: 'ok', environment: env.FAREJADOR_ENV });
    } catch {
      logger.error({ environment: env.FAREJADOR_ENV }, 'health check failed');
      return reply.status(503).send({ status: 'error', reason: 'database_unavailable' });
    }
  });
}
