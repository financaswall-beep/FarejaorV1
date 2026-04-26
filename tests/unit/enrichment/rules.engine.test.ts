import { describe, expect, it } from 'vitest';
import { applyRules } from '../../../src/enrichment/rules.engine.js';
import type { LoadedSegment } from '../../../src/enrichment/rules.types.js';

function makeSegment(rules: LoadedSegment['ruleset']['rules']): LoadedSegment {
  return {
    segment: 'test',
    ruleset: {
      segment: 'test',
      locale: 'pt-BR',
      extractor_version: 'f2a_rules_v1',
      rules,
    },
    lexicon: { locale: 'pt-BR', synonyms: {}, stopwords: [] },
    rulesetHash: 'abcd1234',
  };
}

function makeMessage(content: string, overrides?: Partial<{ message_id: string; sender_type: string }>) {
  return {
    message_id: overrides?.message_id ?? 'msg-1',
    content,
    sender_type: overrides?.sender_type ?? 'contact',
    sent_at: new Date('2026-04-25T12:00:00Z'),
  };
}

describe('rules.engine', () => {
  it('applies keyword rule', () => {
    const segment = makeSegment([
      {
        id: 'test_keyword',
        type: 'keyword',
        target: 'hint',
        hint_type: 'price_complaint',
        keywords: ['caro'],
        confidence_level: 0.85,
      },
    ]);

    const result = applyRules([makeMessage('Tá muito caro')], 'conv-1', 'test', segment);
    expect(result.hints).toHaveLength(1);
    expect(result.hints[0]!.hint_type).toBe('price_complaint');
    expect(result.hints[0]!.matched_text).toBe('caro');
    expect(result.hints[0]!.confidence_level).toBe(0.85);
    expect(result.facts).toHaveLength(0);
  });

  it('applies regex rule for hint', () => {
    const segment = makeSegment([
      {
        id: 'test_regex_hint',
        type: 'regex',
        target: 'hint',
        hint_type: 'abandonment_marker',
        patterns: ['\\?\\?+'],
        confidence_level: 0.70,
      },
    ]);

    const result = applyRules([makeMessage('???')], 'conv-1', 'test', segment);
    expect(result.hints).toHaveLength(1);
    expect(result.hints[0]!.hint_type).toBe('abandonment_marker');
    expect(result.hints[0]!.matched_text).toBe('???');
  });

  it('applies regex rule for fact', () => {
    const segment = makeSegment([
      {
        id: 'test_regex_fact',
        type: 'regex',
        target: 'fact',
        fact_key: 'price_quoted',
        patterns: ['(\\d+\\s?reais)'],
        confidence_level: 0.90,
      },
    ]);

    const result = applyRules([makeMessage('Custa 150 reais')], 'conv-1', 'test', segment);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.fact_key).toBe('price_quoted');
    expect(result.facts[0]!.fact_value).toEqual({ text: '150 reais', raw: '150 reais' });
  });

  it('applies phrase_set rule', () => {
    const segment = makeSegment([
      {
        id: 'test_phrase',
        type: 'phrase_set',
        target: 'hint',
        hint_type: 'competitor_mention',
        phrases: ['outro lugar'],
        confidence_level: 0.90,
      },
    ]);

    const result = applyRules([makeMessage('Vi mais barato em outro lugar')], 'conv-1', 'test', segment);
    expect(result.hints).toHaveLength(1);
    expect(result.hints[0]!.hint_type).toBe('competitor_mention');
    expect(result.hints[0]!.matched_text).toBe('outro lugar');
  });

  it('ignores null content', () => {
    const segment = makeSegment([
      {
        id: 'test_keyword',
        type: 'keyword',
        target: 'hint',
        hint_type: 'price_complaint',
        keywords: ['caro'],
        confidence_level: 0.85,
      },
    ]);

    const result = applyRules([makeMessage('')], 'conv-1', 'test', segment);
    expect(result.hints).toHaveLength(0);
  });

  it('template segment produces no results', () => {
    const segment: LoadedSegment = {
      segment: '_template',
      ruleset: {
        segment: '_template',
        locale: 'pt-BR',
        extractor_version: 'f2a_rules_v1',
        rules: [],
      },
      lexicon: { locale: 'pt-BR', synonyms: {}, stopwords: [] },
      rulesetHash: 'template1234',
    };

    const result = applyRules([makeMessage('Qualquer coisa caro urgente')], 'conv-1', 'test', segment);
    expect(result.hints).toHaveLength(0);
    expect(result.facts).toHaveLength(0);
  });

  it('changing ruleset changes results', () => {
    const segA = makeSegment([
      {
        id: 'rule_a',
        type: 'keyword',
        target: 'hint',
        hint_type: 'urgency_marker',
        keywords: ['hoje'],
        confidence_level: 0.80,
      },
    ]);

    const segB = makeSegment([
      {
        id: 'rule_b',
        type: 'keyword',
        target: 'hint',
        hint_type: 'price_complaint',
        keywords: ['caro'],
        confidence_level: 0.85,
      },
    ]);

    const msg = makeMessage('hoje');
    const resA = applyRules([msg], 'conv-1', 'test', segA);
    const resB = applyRules([msg], 'conv-1', 'test', segB);

    expect(resA.hints[0]!.hint_type).toBe('urgency_marker');
    expect(resB.hints).toHaveLength(0);
  });

  it('carries ruleset_hash in hints', () => {
    const segment = makeSegment([
      {
        id: 'test_hash',
        type: 'keyword',
        target: 'hint',
        hint_type: 'positive_marker',
        keywords: ['ok'],
        confidence_level: 0.75,
      },
    ]);

    const result = applyRules([makeMessage('ok')], 'conv-1', 'test', segment);
    expect(result.hints[0]!.ruleset_hash).toBe('abcd1234');
  });

  it('carries ruleset_hash in facts', () => {
    const segment = makeSegment([
      {
        id: 'test_hash_fact',
        type: 'regex',
        target: 'fact',
        fact_key: 'price_quoted',
        patterns: ['(\\d+)'],
        confidence_level: 0.90,
      },
    ]);

    const result = applyRules([makeMessage('100')], 'conv-1', 'test', segment);
    expect(result.facts[0]!.ruleset_hash).toBe('abcd1234');
  });
});
