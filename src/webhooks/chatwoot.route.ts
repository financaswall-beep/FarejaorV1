import type { FastifyInstance } from 'fastify';
import { chatwootWebhookHandler } from './chatwoot.handler.js';

export async function registerChatwootWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/webhooks/chatwoot', chatwootWebhookHandler);
}
