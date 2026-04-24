import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdminAuth } from './auth.js';
import { replayRawEvent } from './replay.service.js';
import { pool } from '../persistence/db.js';
import { logger } from '../shared/logger.js';

const paramsSchema = z.object({
  raw_event_id: z.coerce.number().int().positive(),
});

export async function registerReplayRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/admin/replay/:raw_event_id', {
    preHandler: requireAdminAuth,
    handler: async (request, reply) => {
      const parsed = paramsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.status(400).send({ error: 'invalid raw_event_id' });
      }

      const rawEventId = parsed.data.raw_event_id;
      const result = await replayRawEvent(pool, rawEventId);

      if (result === null) {
        return reply.status(404).send({ error: 'not found' });
      }

      logger.info({ actor: 'admin', raw_event_id: rawEventId }, 'raw event replayed');

      return reply.status(200).send({
        replayed: true,
        raw_event_id: result.rawEventId,
        previous_status: result.previousStatus,
      });
    },
  });
}
