import type { PoolClient } from 'pg';
import { env } from '../shared/config/env.js';

export async function claimDelivery(
  client: PoolClient,
  chatwootDeliveryId: string,
): Promise<boolean> {
  const result = await client.query(
    `INSERT INTO raw.delivery_seen (environment, chatwoot_delivery_id)
     VALUES ($1, $2)
     ON CONFLICT (environment, chatwoot_delivery_id) DO NOTHING
     RETURNING 1`,
    [env.FAREJADOR_ENV, chatwootDeliveryId],
  );
  return result.rowCount === 1;
}

export async function linkDeliveryToRawEvent(
  client: PoolClient,
  chatwootDeliveryId: string,
  rawEventId: number,
): Promise<void> {
  await client.query(
    `UPDATE raw.delivery_seen
     SET raw_event_id = $1
     WHERE environment = $2 AND chatwoot_delivery_id = $3`,
    [rawEventId, env.FAREJADOR_ENV, chatwootDeliveryId],
  );
}
