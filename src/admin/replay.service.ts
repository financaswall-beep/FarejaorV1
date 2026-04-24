import type { Pool } from 'pg';
import { env } from '../shared/config/env.js';

export interface ReplayResult {
  rawEventId: number;
  previousStatus: string | null;
}

export async function replayRawEvent(pool: Pool, rawEventId: number): Promise<ReplayResult | null> {
  const result = await pool.query<{
    id: number;
    previous_status: string | null;
  }>(
    `WITH prev AS (
       SELECT id, processing_status
       FROM raw.raw_events
       WHERE id = $1 AND environment = $2
       FOR UPDATE
     )
     UPDATE raw.raw_events
     SET processing_status = 'pending',
         processing_error = NULL,
         processed_at = NULL
     FROM prev
     WHERE raw.raw_events.id = prev.id
       AND raw.raw_events.environment = $2
     RETURNING raw.raw_events.id, prev.processing_status AS previous_status`,
    [rawEventId, env.FAREJADOR_ENV],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    rawEventId: row.id,
    previousStatus: row.previous_status,
  };
}
