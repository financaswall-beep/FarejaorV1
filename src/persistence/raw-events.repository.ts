import type { PoolClient } from 'pg';
import { env } from '../shared/config/env.js';

interface InsertRawEventInput {
  chatwootDeliveryId: string;
  chatwootSignature: string;
  chatwootTimestamp: Date;
  eventType: string;
  accountId: number | null;
  payload: unknown;
}

export async function insertRawEvent(
  client: PoolClient,
  input: InsertRawEventInput,
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO raw.raw_events (
       environment,
       chatwoot_delivery_id,
       chatwoot_signature,
       chatwoot_timestamp,
       event_type,
       account_id,
       payload,
       processing_status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING id`,
    [
      env.FAREJADOR_ENV,
      input.chatwootDeliveryId,
      input.chatwootSignature,
      input.chatwootTimestamp,
      input.eventType,
      input.accountId,
      JSON.stringify(input.payload),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('INSERT INTO raw.raw_events did not return an id');
  }

  return row.id;
}
