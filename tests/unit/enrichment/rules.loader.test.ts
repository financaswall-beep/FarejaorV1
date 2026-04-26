import { describe, expect, it } from 'vitest';
import {
  loadRouting,
  resolveSegment,
  loadRuleset,
  loadLexicon,
  computeRulesetHash,
  loadSegment,
} from '../../../src/enrichment/rules.loader.js';
import { rulesetSchema, routeSchema } from '../../../src/enrichment/rules.types.js';
import type { Routing } from '../../../src/enrichment/rules.types.js';

describe('rules.loader', () => {
  describe('loadRouting', () => {
    it('loads and validates routing.json', async () => {
      const routing = await loadRouting();
      expect(routing.defaultSegment).toBe('generic');
      expect(routing.routes).toBeInstanceOf(Array);
      expect(routing.routes.length).toBeGreaterThan(0);
    });
  });

  describe('resolveSegment', () => {
    const routing: Routing = {
      defaultSegment: 'generic',
      routes: [
        { environment: 'prod', chatwoot_account_id: 1, chatwoot_inbox_id: null, segment: 'generic' },
        { environment: 'prod', chatwoot_account_id: 1, chatwoot_inbox_id: 5, segment: 'special' },
        { environment: 'test', chatwoot_account_id: 2, chatwoot_inbox_id: null, segment: '_template' },
      ],
    };

    it('returns segment by environment + account_id', () => {
      expect(resolveSegment(routing, 'prod', 1, null)).toBe('generic');
      expect(resolveSegment(routing, 'test', 2, null)).toBe('_template');
    });

    it('returns segment by inbox when specified', () => {
      expect(resolveSegment(routing, 'prod', 1, 5)).toBe('special');
    });

    it('falls back to account route when inbox does not match', () => {
      expect(resolveSegment(routing, 'prod', 1, 99)).toBe('generic');
    });

    it('falls back to defaultSegment when no route matches', () => {
      expect(resolveSegment(routing, 'prod', 999, null)).toBe('generic');
      expect(resolveSegment(routing, 'staging', 1, null)).toBe('generic');
    });
  });

  describe('schemas', () => {
    it('accepts route without chatwoot_inbox_id', () => {
      const route = routeSchema.parse({
        environment: 'prod',
        chatwoot_account_id: 1,
        segment: 'generic',
      });

      expect(route.chatwoot_inbox_id).toBeUndefined();
    });

    it('rejects regex hint rule without hint_type', () => {
      expect(() =>
        rulesetSchema.parse({
          segment: 'generic',
          locale: 'pt-BR',
          extractor_version: 'f2a_rules_v1',
          rules: [
            {
              id: 'broken_hint',
              type: 'regex',
              target: 'hint',
              patterns: ['caro'],
              confidence_level: 0.8,
            },
          ],
        }),
      ).toThrow();
    });

    it('rejects regex fact rule without fact_key', () => {
      expect(() =>
        rulesetSchema.parse({
          segment: 'generic',
          locale: 'pt-BR',
          extractor_version: 'f2a_rules_v1',
          rules: [
            {
              id: 'broken_fact',
              type: 'regex',
              target: 'fact',
              patterns: ['(\\d+)'],
              confidence_level: 0.8,
            },
          ],
        }),
      ).toThrow();
    });

    it('rejects invalid regex patterns before runtime', () => {
      expect(() =>
        rulesetSchema.parse({
          segment: 'generic',
          locale: 'pt-BR',
          extractor_version: 'f2a_rules_v1',
          rules: [
            {
              id: 'broken_regex',
              type: 'regex',
              target: 'hint',
              hint_type: 'price_complaint',
              patterns: ['('],
              confidence_level: 0.8,
            },
          ],
        }),
      ).toThrow();
    });

    it('rejects duplicate rule ids', () => {
      expect(() =>
        rulesetSchema.parse({
          segment: 'generic',
          locale: 'pt-BR',
          extractor_version: 'f2a_rules_v1',
          rules: [
            {
              id: 'duplicate',
              type: 'keyword',
              target: 'hint',
              hint_type: 'price_complaint',
              keywords: ['caro'],
              confidence_level: 0.8,
            },
            {
              id: 'duplicate',
              type: 'keyword',
              target: 'hint',
              hint_type: 'urgency_marker',
              keywords: ['urgente'],
              confidence_level: 0.8,
            },
          ],
        }),
      ).toThrow();
    });
  });

  describe('loadRuleset', () => {
    it('validates locale', async () => {
      const ruleset = await loadRuleset('generic');
      expect(ruleset.locale).toBe('pt-BR');
    });

    it('loads _template ruleset with empty rules', async () => {
      const ruleset = await loadRuleset('_template');
      expect(ruleset.extractor_version).toBe('f2a_rules_v1');
      expect(ruleset.rules).toEqual([]);
    });

    it('loads generic ruleset with rules array', async () => {
      const ruleset = await loadRuleset('generic');
      expect(ruleset.extractor_version).toBe('f2a_rules_v1');
      expect(ruleset.rules.length).toBeGreaterThan(0);
    });
  });

  describe('loadLexicon', () => {
    it('loads generic lexicon', async () => {
      const lexicon = await loadLexicon('generic');
      expect(lexicon.locale).toBe('pt-BR');
      expect(Array.isArray(lexicon.stopwords)).toBe(true);
    });
  });

  describe('computeRulesetHash', () => {
    it('returns a 64-char hex sha256', async () => {
      const hash = await computeRulesetHash('generic');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces deterministic hash for same files', async () => {
      const h1 = await computeRulesetHash('generic');
      const h2 = await computeRulesetHash('generic');
      expect(h1).toBe(h2);
    });

    it('produces different hash for different segments', async () => {
      const h1 = await computeRulesetHash('generic');
      const h2 = await computeRulesetHash('_template');
      expect(h1).not.toBe(h2);
    });
  });

  describe('loadSegment', () => {
    it('loads full segment with hash', async () => {
      const segment = await loadSegment('generic');
      expect(segment.segment).toBe('generic');
      expect(segment.rulesetHash).toMatch(/^[a-f0-9]{64}$/);
      expect(segment.ruleset.rules.length).toBeGreaterThan(0);
      expect(segment.lexicon.stopwords.length).toBeGreaterThan(0);
    });
  });
});
