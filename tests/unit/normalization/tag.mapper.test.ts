import { describe, it, expect } from 'vitest';
import { mapTags } from '../../../src/normalization/tag.mapper.js';

const environment = 'prod';
const addedAt = new Date('2026-04-23T12:00:00Z');

describe('tag.mapper', () => {
  it('maps labels to tags', () => {
    const result = mapTags({ id: 101, labels: ['suporte', 'vip'] }, environment, addedAt);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      environment: 'prod',
      chatwootConversationId: 101,
      label: 'suporte',
      addedAt,
      addedByType: null,
    });
    expect(result[1].label).toBe('vip');
  });

  it('returns empty array when no labels', () => {
    const result = mapTags({ id: 101 }, environment, addedAt);
    expect(result).toEqual([]);
  });
});
