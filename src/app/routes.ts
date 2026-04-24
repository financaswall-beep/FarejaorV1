import type { FastifyInstance } from 'fastify';
import { registerChatwootWebhookRoutes } from '../webhooks/chatwoot.route.js';
import { registerHealthRoute } from '../admin/health.route.js';
import { registerReplayRoute } from '../admin/replay.route.js';
import { registerReconcileRoute } from '../admin/reconcile.route.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await registerChatwootWebhookRoutes(fastify);
  await registerHealthRoute(fastify);
  await registerReplayRoute(fastify);
  await registerReconcileRoute(fastify);
}
