import type { FastifyReply, FastifyRequest } from 'fastify';
import { pool } from '../persistence/db.js';
import { claimDelivery, linkDeliveryToRawEvent } from '../persistence/delivery-seen.repository.js';
import { insertRawEvent } from '../persistence/raw-events.repository.js';
import { env } from '../shared/config/env.js';
import { logger } from '../shared/logger.js';
import { chatwootWebhookEnvelopeSchema, chatwootWebhookHeadersSchema } from '../shared/types/chatwoot.js';
import { parseChatwootTimestamp, validateHmac, validateTimestamp } from './chatwoot.hmac.js';

interface WebhookBody {
  raw: Buffer;
  parsed: unknown;
}

function isWebhookBody(body: unknown): body is WebhookBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    Buffer.isBuffer((body as { raw?: unknown }).raw) &&
    'parsed' in body
  );
}

export async function chatwootWebhookHandler(
  request: FastifyRequest<{ Body: WebhookBody }>,
  reply: FastifyReply,
): Promise<void> {
  if (!isWebhookBody(request.body)) {
    return reply.status(400).send({ error: 'Invalid request body' });
  }

  const rawBody = request.body.raw;
  const parsedBody = request.body.parsed;

  const headersResult = chatwootWebhookHeadersSchema.safeParse(request.headers);
  if (!headersResult.success) {
    return reply.status(401).send({ error: 'Missing required headers' });
  }

  const headers = headersResult.data;
  const chatwootDeliveryId = headers['x-chatwoot-delivery'];
  const chatwootSignature = headers['x-chatwoot-signature'];
  const chatwootTimestamp = headers['x-chatwoot-timestamp'];

  const logCtx = {
    chatwoot_delivery_id: chatwootDeliveryId,
    environment: env.FAREJADOR_ENV,
  };

  if (!chatwootTimestamp || !validateTimestamp(chatwootTimestamp)) {
    logger.warn(logCtx, 'webhook timestamp missing or expired');
    return reply.status(401).send({ error: 'Timestamp missing or expired' });
  }

  const parsedTimestamp = parseChatwootTimestamp(chatwootTimestamp);
  if (!parsedTimestamp) {
    logger.warn(logCtx, 'webhook timestamp invalid');
    return reply.status(401).send({ error: 'Timestamp invalid' });
  }

  if (!validateHmac(rawBody, chatwootSignature)) {
    logger.warn(logCtx, 'webhook HMAC validation failed');
    return reply.status(401).send({ error: 'Invalid signature' });
  }

  const envelopeResult = chatwootWebhookEnvelopeSchema.safeParse(parsedBody);
  if (!envelopeResult.success) {
    logger.warn({ ...logCtx, reason: 'schema validation failed' }, 'webhook payload invalid');
    return reply.status(400).send({ error: 'Invalid payload' });
  }

  const envelope = envelopeResult.data;
  const eventType = envelope.event;
  const accountId = envelope.account?.id ?? null;
  const handlerLogCtx = {
    ...logCtx,
    event_type: eventType,
  };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const claimed = await claimDelivery(client, chatwootDeliveryId);
    if (!claimed) {
      await client.query('ROLLBACK');
      logger.warn(handlerLogCtx, 'duplicate delivery skipped');
      return reply.status(200).send({ received: true, delivery_id: chatwootDeliveryId });
    }

    const rawEventId = await insertRawEvent(client, {
      chatwootDeliveryId,
      chatwootSignature,
      chatwootTimestamp: parsedTimestamp,
      eventType,
      accountId,
      payload: parsedBody,
    });

    await linkDeliveryToRawEvent(client, chatwootDeliveryId, rawEventId);

    await client.query('COMMIT');

    logger.info(handlerLogCtx, 'webhook received and persisted');
    return reply.status(200).send({ received: true, delivery_id: chatwootDeliveryId });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error({ err, ...handlerLogCtx }, 'failed to persist webhook');
    return reply.status(500).send({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}
