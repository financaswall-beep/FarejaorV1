import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgres, stopPostgres, type IntegrationDb } from './helpers/postgres';

let db: IntegrationDb;

beforeAll(async () => {
  db = await startPostgres();
});

afterAll(async () => {
  if (db) await stopPostgres(db);
});

async function insertRaw(deliveryId: string): Promise<bigint> {
  const result = await db.pool.query<{ id: string }>(
    `INSERT INTO raw.raw_events
       (environment, chatwoot_delivery_id, chatwoot_signature, chatwoot_timestamp,
        received_at, event_type, account_id, payload)
     VALUES ('test', $1, 'sig', '2026-04-15T10:00:00Z',
             '2026-04-15T10:00:00Z', 'message_created', 1, '{"k":"v"}'::jsonb)
     RETURNING id`,
    [deliveryId],
  );
  return BigInt(result.rows[0].id);
}

describe('migration 0007 — raw.raw_events immutability guard', () => {
  it('blocks DELETE with restrict_violation', async () => {
    const id = await insertRaw('delivery-delete-1');
    await expect(
      db.pool.query('DELETE FROM raw.raw_events WHERE id = $1', [id]),
    ).rejects.toMatchObject({ code: '23001' });
  });

  it('blocks UPDATE on payload column', async () => {
    const id = await insertRaw('delivery-payload-1');
    await expect(
      db.pool.query(
        `UPDATE raw.raw_events SET payload = '{"tampered":true}'::jsonb WHERE id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: '23001' });
  });

  it('blocks UPDATE on event_type column', async () => {
    const id = await insertRaw('delivery-evt-1');
    await expect(
      db.pool.query(
        `UPDATE raw.raw_events SET event_type = 'forged' WHERE id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: '23001' });
  });

  it('allows UPDATE on processing_status / processing_error / processed_at', async () => {
    const id = await insertRaw('delivery-status-1');
    await expect(
      db.pool.query(
        `UPDATE raw.raw_events
            SET processing_status = 'processed',
                processed_at = now(),
                processing_error = NULL
          WHERE id = $1`,
        [id],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });
});
