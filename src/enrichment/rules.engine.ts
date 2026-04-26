import type { LoadedSegment, Hint, Fact, Rule, KeywordRule, RegexRule, PhraseSetRule } from './rules.types.js';

export interface EngineMessage {
  message_id: string;
  content: string | null;
  sender_type: string;
  sent_at: Date;
}

export interface EngineResult {
  hints: Hint[];
  facts: Fact[];
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function applyKeywordRule(
  rule: KeywordRule,
  message: EngineMessage,
  conversationId: string,
  environment: string,
  rulesetHash: string,
  extractorVersion: string,
): Hint | null {
  if (!message.content) return null;
  const normalized = normalizeText(message.content);

  for (const keyword of rule.keywords) {
    const normKeyword = normalizeText(keyword);
    if (normalized.includes(normKeyword)) {
      return {
        conversation_id: conversationId,
        environment,
        message_id: message.message_id,
        hint_type: rule.hint_type,
        matched_text: keyword,
        pattern_id: rule.id,
        truth_type: 'observed',
        source: 'deterministic_rules_v1',
        confidence_level: rule.confidence_level,
        extractor_version: extractorVersion,
        ruleset_hash: rulesetHash,
      };
    }
  }
  return null;
}

function applyRegexRule(
  rule: RegexRule,
  message: EngineMessage,
  conversationId: string,
  environment: string,
  rulesetHash: string,
  extractorVersion: string,
): Hint | Fact | null {
  if (!message.content) return null;

  for (const pattern of rule.patterns) {
    const regex = new RegExp(pattern, 'i');
    const match = message.content.match(regex);
    if (match) {
      if (rule.target === 'hint' && rule.hint_type) {
        return {
          conversation_id: conversationId,
          environment,
          message_id: message.message_id,
          hint_type: rule.hint_type,
          matched_text: match[0] ?? null,
          pattern_id: rule.id,
          truth_type: 'observed',
          source: 'deterministic_rules_v1',
          confidence_level: rule.confidence_level,
          extractor_version: extractorVersion,
          ruleset_hash: rulesetHash,
        };
      }

      if (rule.target === 'fact' && rule.fact_key) {
        const captured = match[1] ?? match[0] ?? null;
        return {
          environment,
          conversation_id: conversationId,
          fact_key: rule.fact_key,
          fact_value: captured != null ? { text: captured, raw: match[0] } : {},
          observed_at: message.sent_at,
          message_id: message.message_id,
          truth_type: 'observed',
          source: 'deterministic_rules_v1',
          confidence_level: rule.confidence_level,
          extractor_version: extractorVersion,
          ruleset_hash: rulesetHash,
        };
      }
    }
  }
  return null;
}

function applyPhraseSetRule(
  rule: PhraseSetRule,
  message: EngineMessage,
  conversationId: string,
  environment: string,
  rulesetHash: string,
  extractorVersion: string,
): Hint | null {
  if (!message.content) return null;
  const normalized = normalizeText(message.content);

  for (const phrase of rule.phrases) {
    const normPhrase = normalizeText(phrase);
    if (normalized.includes(normPhrase)) {
      return {
        conversation_id: conversationId,
        environment,
        message_id: message.message_id,
        hint_type: rule.hint_type,
        matched_text: phrase,
        pattern_id: rule.id,
        truth_type: 'observed',
        source: 'deterministic_rules_v1',
        confidence_level: rule.confidence_level,
        extractor_version: extractorVersion,
        ruleset_hash: rulesetHash,
      };
    }
  }
  return null;
}

function applyRule(
  rule: Rule,
  message: EngineMessage,
  conversationId: string,
  environment: string,
  rulesetHash: string,
  extractorVersion: string,
): Hint | Fact | null {
  switch (rule.type) {
    case 'keyword':
      return applyKeywordRule(rule, message, conversationId, environment, rulesetHash, extractorVersion);
    case 'regex':
      return applyRegexRule(rule, message, conversationId, environment, rulesetHash, extractorVersion);
    case 'phrase_set':
      return applyPhraseSetRule(rule, message, conversationId, environment, rulesetHash, extractorVersion);
    default:
      return null;
  }
}

export function applyRules(
  messages: EngineMessage[],
  conversationId: string,
  environment: string,
  segment: LoadedSegment,
): EngineResult {
  const hints: Hint[] = [];
  const facts: Fact[] = [];

  const extractorVersion = segment.ruleset.extractor_version;

  for (const message of messages) {
    for (const rule of segment.ruleset.rules) {
      const result = applyRule(rule, message, conversationId, environment, segment.rulesetHash, extractorVersion);
      if (!result) continue;

      if ('hint_type' in result) {
        hints.push(result as Hint);
      } else {
        facts.push(result as Fact);
      }
    }
  }

  return { hints, facts };
}
