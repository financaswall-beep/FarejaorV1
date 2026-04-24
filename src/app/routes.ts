import type { FastifyInstance } from 'fastify';
import { registerChatwootWebhookRoutes } from '../webhooks/chatwoot.route.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await registerChatwootWebhookRoutes(fastify);
}
