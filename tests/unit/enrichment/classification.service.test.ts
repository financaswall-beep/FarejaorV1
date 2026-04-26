import { describe, expect, it } from 'vitest';
import { classifyConversation, deriveRulesetHash } from '../../../src/enrichment/classification.service.js';
import type { ConversationData } from '../../../src/enrichment/classification.service.js';

function makeData(overrides?: Partial<ConversationData>): ConversationData {
  return {
    signals: null,
    hints: [],
    facts: [],
    ...overrides,
  };
}

describe('classification.service', () => {
  describe('deriveRulesetHash', () => {
    it('returns no_ruleset_v1 for empty set', () => {
      expect(deriveRulesetHash(new Set())).toBe('no_ruleset_v1');
    });

    it('returns single hash unchanged', () => {
      expect(deriveRulesetHash(new Set(['abc123']))).toBe('abc123');
    });

    it('combines multiple hashes with sha256', () => {
      const h1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const h2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const result = deriveRulesetHash(new Set([h2, h1]));
      expect(result).not.toBe(h1);
      expect(result).not.toBe(h2);
      expect(result).not.toBe('no_ruleset_v1');
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('ignores no_ruleset_v1 in combined hash', () => {
      const h1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const result = deriveRulesetHash(new Set([h1, 'no_ruleset_v1']));
      expect(result).toBe(h1);
    });
  });

  describe('classifyConversation', () => {
    it('does not classify when there is no evidence', () => {
      const result = classifyConversation(makeData());
      expect(result).toHaveLength(0);
    });

    it('detects urgency=high from urgency_marker hint', () => {
      const data = makeData({
        hints: [{ hint_type: 'urgency_marker', ruleset_hash: 'hashA' }],
      });
      const result = classifyConversation(data);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        dimension: 'urgency',
        value: 'high',
        confidence_level: 0.80,
        ruleset_hash: 'hashA',
      });
    });

    it('detects loss_reason=price from price_complaint without positive_marker', () => {
      const data = makeData({
        hints: [
          { hint_type: 'price_complaint', ruleset_hash: 'hashA' },
        ],
      });
      const result = classifyConversation(data);
      expect(result.some((r) => r.dimension === 'loss_reason' && r.value === 'price')).toBe(true);
      expect(result.find((r) => r.dimension === 'loss_reason')!.confidence_level).toBe(0.75);
    });

    it('detects buyer_intent=high from positive_marker + price_quoted fact', () => {
      const data = makeData({
        hints: [{ hint_type: 'positive_marker', ruleset_hash: 'hashA' }],
        facts: [{ fact_key: 'price_quoted', ruleset_hash: 'hashB' }],
      });
      const result = classifyConversation(data);
      expect(result.some((r) => r.dimension === 'buyer_intent' && r.value === 'high')).toBe(true);
      expect(result.find((r) => r.dimension === 'buyer_intent')!.confidence_level).toBe(0.85);
    });

    it('detects stage_reached=quote_sent from price_quoted fact alone', () => {
      const data = makeData({
        facts: [{ fact_key: 'price_quoted', ruleset_hash: 'hashB' }],
      });
      const result = classifyConversation(data);
      expect(result.some((r) => r.dimension === 'stage_reached' && r.value === 'quote_sent')).toBe(true);
      expect(result.find((r) => r.dimension === 'stage_reached')!.confidence_level).toBe(0.80);
    });

    it('detects stage_reached=purchase_intent from positive_marker + price_quoted', () => {
      const data = makeData({
        hints: [{ hint_type: 'positive_marker', ruleset_hash: 'hashA' }],
        facts: [{ fact_key: 'price_quoted', ruleset_hash: 'hashB' }],
      });
      const result = classifyConversation(data);
      const stage = result.filter((r) => r.dimension === 'stage_reached');
      expect(stage).toHaveLength(1);
      expect(stage[0]!.value).toBe('purchase_intent');
      expect(stage[0]!.confidence_level).toBe(0.85);
    });

    it('uses combined ruleset_hash when multiple hashes are involved', () => {
      const data = makeData({
        hints: [{ hint_type: 'positive_marker', ruleset_hash: 'hashA' }],
        facts: [{ fact_key: 'price_quoted', ruleset_hash: 'hashB' }],
      });
      const result = classifyConversation(data);
      const buyer = result.find((r) => r.dimension === 'buyer_intent');
      expect(buyer!.ruleset_hash).not.toBe('hashA');
      expect(buyer!.ruleset_hash).not.toBe('hashB');
      expect(buyer!.ruleset_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('does not generate loss_reason=price when positive_marker is present', () => {
      const data = makeData({
        hints: [
          { hint_type: 'price_complaint', ruleset_hash: 'hashA' },
          { hint_type: 'positive_marker', ruleset_hash: 'hashB' },
        ],
      });
      const result = classifyConversation(data);
      expect(result.some((r) => r.dimension === 'loss_reason')).toBe(false);
    });

    it('detects final_outcome=won from positive_marker + price_quoted', () => {
      const data = makeData({
        hints: [{ hint_type: 'positive_marker', ruleset_hash: 'hashA' }],
        facts: [{ fact_key: 'price_quoted', ruleset_hash: 'hashB' }],
      });
      const result = classifyConversation(data);
      expect(result.some((r) => r.dimension === 'final_outcome' && r.value === 'won')).toBe(true);
    });

    it('detects final_outcome=lost from price_complaint + abandonment_marker', () => {
      const data = makeData({
        hints: [
          { hint_type: 'price_complaint', ruleset_hash: 'hashA' },
          { hint_type: 'abandonment_marker', ruleset_hash: 'hashB' },
        ],
      });
      const result = classifyConversation(data);
      expect(result.some((r) => r.dimension === 'final_outcome' && r.value === 'lost')).toBe(true);
    });

    it('does not contain tire vocabulary', () => {
      const data = makeData({
        hints: [{ hint_type: 'positive_marker', ruleset_hash: 'hashA' }],
      });
      const result = classifyConversation(data);
      for (const r of result) {
        expect(r.value.toLowerCase()).not.toContain('pneu');
        expect(r.value.toLowerCase()).not.toContain('tire');
        expect(r.value.toLowerCase()).not.toContain('aro');
      }
    });
  });
});
