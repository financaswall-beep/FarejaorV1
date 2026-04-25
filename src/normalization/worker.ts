import type { PoolClient } from 'pg';
import { pool } from '../persistence/db.js';
import { env } from '../shared/config/env.js';
import { logger } from '../shared/logger.js';
import { dispatch, SkipEventError } from './dispatcher.js';

const MAX_PER_POLL = 50; // máximo de eventos drenados por ciclo de poll; encerra mais cedo se a fila esvaziar
const POLL_INTERVAL_MS = 5_000;

interface RawEventRow {
  id: number;
  event_type: string;
  payload: unknown;
  environment: string;
  chatwoot_timestamp: Date | null;
}

export async function pollAndNormalize(): Promise<void> {
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    for (let processedCount = 0; processedCount < MAX_PER_POLL; processedCount++) {
      let row: RawEventRow | undefined;

      try {
        await client.query('BEGIN');

        const result = await client.query<RawEventRow>(
          `SELECT id, event_type, payload, environment, chatwoot_timestamp
           FROM raw.raw_events
           WHERE processing_status = 'pending'
             AND environment = $1
           ORDER BY received_at
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [env.FAREJADOR_ENV],
        );

        row = result.rows[0];
        if (!row) {
          await client.query('COMMIT');
          return;
        }

        await client.query('SAVEPOINT normalize_event');
        await dispatch(client, row);
        await client.query(
          `UPDATE raw.raw_events
           SET processing_status = 'processed',
               processed_at = now()
           WHERE id = $1`,
          [row.id],
        );
        await client.query('RELEASE SAVEPOINT normalize_event');
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT normalize_event').catch(() => {});

        if (!row) {
          throw err;
        }

        if (err instanceof SkipEventError) {
          await client.query(
            `UPDATE raw.raw_events
             SET processing_status = 'skipped',
                 processed_at = now()
             WHERE id = $1`,
            [row.id],
          );
          await client.query('COMMIT');
          continue;
        }

        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(
          { err, raw_event_id: row.id, event_type: row.event_type },
          'normalization failed',
        );

        await client.query(
          `UPDATE raw.raw_events
           SET processing_status = 'failed',
               processing_error = $1,
               processed_at = now()
           WHERE id = $2`,
          [errorMessage, row.id],
        );
        await client.query('COMMIT');
      }
    }
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    logger.error({ err }, 'worker poll failed');
  } finally {
    client?.release();
  }
}

export function startWorker(): () => void {
  let stopped = false;

  async function loop(): Promise<void> {
    if (stopped) return;
    await pollAndNormalize();
    setTimeout(loop, POLL_INTERVAL_MS);
  }

  void loop();

  return function stop(): void {
    stopped = true;
  };
}
