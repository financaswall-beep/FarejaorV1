import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import { env } from '../shared/config/env.js';

export function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const header = request.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    void reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const receivedToken = header.slice(7);
  const expectedToken = env.ADMIN_AUTH_TOKEN;

  const receivedBuf = Buffer.from(receivedToken, 'utf-8');
  const expectedBuf = Buffer.from(expectedToken, 'utf-8');

  if (receivedBuf.length !== expectedBuf.length) {
    // Timing-safe comparison against itself to avoid leaking length difference
    void timingSafeEqual(receivedBuf, receivedBuf);
    void reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const isEqual = timingSafeEqual(receivedBuf, expectedBuf);

  if (!isEqual) {
    void reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  done();
}
