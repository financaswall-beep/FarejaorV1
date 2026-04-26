import { describe, expect, it, vi } from 'vitest';
import { upsertClassifications } from '../../../src/enrichment/classifications.repository.js';
import type { ClassificationInput } from '../../../src/enrichment/classification.service.js';

describe('classifications.repository', () => {
  function createMockClient() {
    return {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      release: vi.fn(),
    };
  }

  function makeClassification(overrides?: Partial<ClassificationInput>): ClassificationInput {
    return {
      dimension: 'urgency',
      value: 'high',
      confidence_level: 0.80,
      ruleset_hash: 'hash1234',
      ...overrides,
    };
  }

  it('inserts into analytics.conversation_classifications', async () => {
    const client = createMockClient();
    const inserted = await upsertClassifications(client as never, 'conv-1', 'test', [makeClassification()]);

    expect(inserted).toBe(1);
    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO analytics.conversation_classifications');
  });

  it('uses ON CONFLICT for idempotency', async () => {
    const client = createMockClient();
    await upsertClassifications(client as never, 'conv-1', 'test', [makeClassification()]);

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT ON CONSTRAINT classifications_dedup_key');
  });

  it('does not write into raw or core', async () => {
    const client = createMockClient();
    await upsertClassifications(client as never, 'conv-1', 'test', [makeClassification()]);

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    const lowerSql = sql.toLowerCase();
    expect(lowerSql).not.toMatch(/insert\s+into\s+raw\./);
    expect(lowerSql).not.toMatch(/insert\s+into\s+core\./);
  });

  it('returns 0 when classifications array is empty', async () => {
    const client = createMockClient();
    const inserted = await upsertClassifications(client as never, 'conv-1', 'test', []);
    expect(inserted).toBe(0);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('includes ruleset_hash in insert params', async () => {
    const client = createMockClient();
    await upsertClassifications(client as never, 'conv-1', 'test', [makeClassification({ ruleset_hash: 'hash5678' })]);

    const params = client.query.mock.calls[0][1] as unknown[];
    expect(params).toContain('hash5678');
  });

  it('sets provenance fields correctly', async () => {
    const client = createMockClient();
    await upsertClassifications(client as never, 'conv-1', 'test', [makeClassification()]);

    const params = client.query.mock.calls[0][1] as unknown[];
    expect(params).toContain('inferred');
    expect(params).toContain('deterministic_classification_v1');
    expect(params).toContain('f2a_classification_v1');
  });
});
