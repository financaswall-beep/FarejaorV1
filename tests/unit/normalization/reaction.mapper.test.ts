import { describe, it, expect } from 'vitest';
import { mapReaction } from '../../../src/normalization/reaction.mapper.js';

const environment = 'prod';
const lastEventAt = new Date('2026-04-23T12:00:00Z');

describe('reaction.mapper', () => {
  it('returns null for any payload (placeholder)', () => {
    const result = mapReaction({}, environment, lastEventAt);
    expect(result).toBeNull();
  });
});
