import { describe, expect, it, vi } from 'vitest';
import { insertFacts } from '../../../src/enrichment/facts.repository.js';
import type { Fact } from '../../../src/enrichment/rules.types.js';

describe('facts.repository', () => {
  function createMockClient() {
    return {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      release: vi.fn(),
    };
  }

  function makeFact(overrides?: Partial<Fact>): Fact {
    return {
      environment: 'test',
      conversation_id: 'conv-1',
      fact_key: 'price_quoted',
      fact_value: { text: '150' },
      observed_at: new Date('2026-04-25T12:00:00Z'),
      message_id: 'msg-1',
      truth_type: 'observed',
      source: 'deterministic_rules_v1',
      confidence_level: 0.90,
      extractor_version: 'f2a_rules_v1',
      ruleset_hash: 'abcd1234',
      ...overrides,
    };
  }

  it('inserts into analytics.conversation_facts', async () => {
    const client = createMockClient();
    const inserted = await insertFacts(client as never, [makeFact()]);

    expect(inserted).toBe(1);
    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO analytics.conversation_facts');
  });

  it('uses ON CONFLICT for idempotency', async () => {
    const client = createMockClient();
    await insertFacts(client as never, [makeFact()]);

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT');
  });

  it('does not write into raw or core', async () => {
    const client = createMockClient();
    await insertFacts(client as never, [makeFact()]);

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    const lowerSql = sql.toLowerCase();
    expect(lowerSql).not.toMatch(/insert\s+into\s+raw\./);
    expect(lowerSql).not.toMatch(/insert\s+into\s+core\./);
  });

  it('returns 0 when facts array is empty', async () => {
    const client = createMockClient();
    const inserted = await insertFacts(client as never, []);
    expect(inserted).toBe(0);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('includes ruleset_hash in insert params', async () => {
    const client = createMockClient();
    await insertFacts(client as never, [makeFact({ ruleset_hash: 'hash9999' })]);

    const params = client.query.mock.calls[0][1] as unknown[];
    expect(params[params.length - 1]).toBe('hash9999');
  });
});
