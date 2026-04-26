import { describe, expect, it, vi } from 'vitest';
import { insertHints } from '../../../src/enrichment/hints.repository.js';
import type { Hint } from '../../../src/enrichment/rules.types.js';

describe('hints.repository', () => {
  function createMockClient() {
    return {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      release: vi.fn(),
    };
  }

  function makeHint(overrides?: Partial<Hint>): Hint {
    return {
      conversation_id: 'conv-1',
      environment: 'test',
      message_id: 'msg-1',
      hint_type: 'price_complaint',
      matched_text: 'caro',
      pattern_id: 'price_complaint_keyword_v1',
      truth_type: 'observed',
      source: 'deterministic_rules_v1',
      confidence_level: 0.85,
      extractor_version: 'f2a_rules_v1',
      ruleset_hash: 'abcd1234',
      ...overrides,
    };
  }

  it('inserts into analytics.linguistic_hints', async () => {
    const client = createMockClient();
    const inserted = await insertHints(client as never, [makeHint()]);

    expect(inserted).toBe(1);
    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO analytics.linguistic_hints');
  });

  it('uses ON CONFLICT DO NOTHING for idempotency', async () => {
    const client = createMockClient();
    await insertHints(client as never, [makeHint()]);

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT ON CONSTRAINT hints_dedup_key DO NOTHING');
  });

  it('does not write into raw or core', async () => {
    const client = createMockClient();
    await insertHints(client as never, [makeHint()]);

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    const lowerSql = sql.toLowerCase();
    expect(lowerSql).not.toMatch(/insert\s+into\s+raw\./);
    expect(lowerSql).not.toMatch(/insert\s+into\s+core\./);
  });

  it('returns 0 when hints array is empty', async () => {
    const client = createMockClient();
    const inserted = await insertHints(client as never, []);
    expect(inserted).toBe(0);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('includes ruleset_hash in insert params', async () => {
    const client = createMockClient();
    await insertHints(client as never, [makeHint({ ruleset_hash: 'hash5678' })]);

    const params = client.query.mock.calls[0][1] as unknown[];
    expect(params[params.length - 1]).toBe('hash5678');
  });
});
