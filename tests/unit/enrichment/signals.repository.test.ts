import { describe, expect, it, vi } from 'vitest';
import { computeAndUpsertSignals } from '../../../src/enrichment/signals.repository.js';

describe('signals.repository', () => {
  function createMockClient() {
    return {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ conversation_id: 'conv-uuid' }] }),
      release: vi.fn(),
    };
  }

  it('executes upsert into analytics.conversation_signals with correct params', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    expect(client.query).toHaveBeenCalledOnce();
    const [sql, params] = client.query.mock.calls[0] as [string, unknown[]];

    expect(params).toEqual(['conv-uuid', 'test', 'America/Sao_Paulo']);
    expect(sql).toContain('INSERT INTO analytics.conversation_signals');
    expect(sql).toContain('ON CONFLICT (conversation_id) DO UPDATE');
    expect(sql).toContain('RETURNING conversation_id');
  });

  it('returns true when a conversation signal row is upserted', async () => {
    const client = createMockClient();
    await expect(computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo')).resolves.toBe(true);
  });

  it('returns false when conversation does not exist in the environment', async () => {
    const client = createMockClient();
    client.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(computeAndUpsertSignals(client as never, 'missing-conv', 'test', 'America/Sao_Paulo')).resolves.toBe(false);
  });

  it('contains all required metrics in the query', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain('total_messages');
    expect(sql).toContain('contact_messages');
    expect(sql).toContain('agent_messages');
    expect(sql).toContain('bot_messages');
    expect(sql).toContain('media_message_count');
    expect(sql).toContain('media_text_ratio');
    expect(sql).toContain('first_response_seconds');
    expect(sql).toContain('avg_agent_response_sec');
    expect(sql).toContain('max_gap_seconds');
    expect(sql).toContain('total_duration_seconds');
    expect(sql).toContain('handoff_count');
    expect(sql).toContain('started_hour_local');
    expect(sql).toContain('started_dow_local');
  });

  it('includes required provenance values', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain("'f2a_signals_v1'");
    expect(sql).toContain("'sql_aggregation_v1'");
    expect(sql).toContain("'observed'");
    expect(sql).toContain('1.00');
  });

  it('reads only from core tables', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain('FROM core.conversations');
    expect(sql).toContain('FROM core.messages');
    expect(sql).toContain('FROM core.message_attachments');
    expect(sql).toContain('FROM core.conversation_assignments');
  });

  it('does not contain INSERT or UPDATE into raw schema', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    const lowerSql = sql.toLowerCase();

    expect(lowerSql).not.toMatch(/insert\s+into\s+raw\./);
    expect(lowerSql).not.toMatch(/update\s+raw\./);
  });

  it('does not contain INSERT or UPDATE into core schema', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    const lowerSql = sql.toLowerCase();

    expect(lowerSql).not.toMatch(/insert\s+into\s+core\./);
    expect(lowerSql).not.toMatch(/update\s+core\./);
  });

  it('covers conversation without messages via COALESCE zeroes', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain('COALESCE(ma.total_messages, 0)');
    expect(sql).toContain('COALESCE(me.media_message_count, 0)');
    expect(sql).toContain('COALESCE(h.handoff_count, 0)');
  });

  it('computes media_text_ratio only when total_messages > 0', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain('CASE WHEN ma.total_messages > 0 THEN');
    expect(sql).toContain('media_text_ratio');
  });

  it('computes first_response_seconds only when agent responds after contact', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain('WHERE a.sent_at > c.sent_at');
    expect(sql).toContain('first_response_seconds');
  });

  it('computes max_gap_seconds from consecutive messages', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain('message_gaps');
    expect(sql).toContain('max_gap_seconds');
  });

  it('passes timezone as a query parameter (no hardcoded zone in SQL)', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'UTC');

    const [sql, params] = client.query.mock.calls[0] as [string, unknown[]];

    expect(params).toEqual(['conv-uuid', 'test', 'UTC']);
    expect(sql).not.toContain("'America/Sao_Paulo'");
    expect(sql).toContain('AT TIME ZONE $3');
  });

  it('computes handoff_count from conversation_assignments', async () => {
    const client = createMockClient();
    await computeAndUpsertSignals(client as never, 'conv-uuid', 'test', 'America/Sao_Paulo');

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain('handoffs');
    expect(sql).toContain('handoff_count');
    expect(sql).toContain('core.conversation_assignments');
  });
});
