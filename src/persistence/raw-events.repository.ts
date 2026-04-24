import type { PoolClient } from 'pg';
import { env } from '../shared/config/env.js';

interface InsertRawEventInput {
  environment?: 'prod' | 'test';
  chatwootDeliveryId: string;
  chatwootSignature: string;
  chatwootTimestamp: Date;
  eventType: string;
  accountId: number | null;
  payload: unknown;
}

export async function claimAndInsertRawEvent(
  client: PoolClient,
  input: InsertRawEventInput,
): Promise<number | null> {
  const result = await client.query<{ id: number }>(
    `WITH next_raw_event_id AS (
       SELECT nextval(pg_get_serial_sequence('raw.raw_events', 'id'))::bigint AS id
     ),
     claim AS (
       INSERT INTO raw.delivery_seen (environment, chatwoot_delivery_id, raw_event_id)
       SELECT $1, $2, next_raw_event_id.id
       FROM next_raw_event_id
       ON CONFLICT (environment, chatwoot_delivery_id) DO NOTHING
       RETURNING raw_event_id
     ),
     inserted AS (
       INSERT INTO raw.raw_events (
         id,
         environment,
         chatwoot_delivery_id,
         chatwoot_signature,
         chatwoot_timestamp,
         event_type,
         account_id,
         payload,
         processing_status
       )
       SELECT raw_event_id, $1, $2, $3, $4, $5, $6, $7, 'pending'
       FROM claim
       RETURNING id
     )
     SELECT id FROM inserted`,
    [
      input.environment ?? env.FAREJADOR_ENV,
      input.chatwootDeliveryId,
      input.chatwootSignature,
      input.chatwootTimestamp,
      input.eventType,
      input.accountId,
      JSON.stringify(input.payload),
    ],
  );

  const row = result.rows[0];
  if (!row && result.rowCount === 0) {
    return null;
  }

  if (!row) {
    throw new Error('INSERT INTO raw.raw_events did not return an id');
  }

  return row.id;
}
