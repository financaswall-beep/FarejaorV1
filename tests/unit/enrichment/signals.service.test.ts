import { describe, expect, it, vi } from 'vitest';
import { enrichConversation } from '../../../src/enrichment/signals.service.js';
import { computeAndUpsertSignals } from '../../../src/enrichment/signals.repository.js';

vi.mock('../../../src/enrichment/signals.repository.js', () => ({
  computeAndUpsertSignals: vi.fn().mockResolvedValue(true),
}));

describe('signals.service', () => {
  it('delegates to repository with correct arguments', async () => {
    const client = {} as never;
    await enrichConversation(client, 'conv-uuid', 'test');

    expect(computeAndUpsertSignals).toHaveBeenCalledTimes(1);
    expect(computeAndUpsertSignals).toHaveBeenCalledWith(client, 'conv-uuid', 'test');
  });

  it('returns repository result', async () => {
    const client = {} as never;
    await expect(enrichConversation(client, 'conv-uuid', 'test')).resolves.toBe(true);
  });
});
