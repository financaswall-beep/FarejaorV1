import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';

export interface ClassificationInput {
  dimension: string;
  value: string;
  confidence_level: number;
  ruleset_hash: string;
  notes?: string;
}

export interface ConversationData {
  signals: ConversationSignals | null;
  hints: ConversationHint[];
  facts: ConversationFact[];
}

export interface ConversationSignals {
  total_messages: number | null;
  contact_messages: number | null;
  agent_messages: number | null;
  first_response_seconds: number | null;
  max_gap_seconds: number | null;
}

export interface ConversationHint {
  hint_type: string;
  ruleset_hash: string;
}

export interface ConversationFact {
  fact_key: string;
  ruleset_hash: string;
}

function hasHint(hints: ConversationHint[], type: string): boolean {
  return hints.some((h) => h.hint_type === type);
}

function hasFact(facts: ConversationFact[], key: string): boolean {
  return facts.some((f) => f.fact_key === key);
}

function getRulesetHashes(hints: ConversationHint[], facts: ConversationFact[]): Set<string> {
  const hashes = new Set<string>();
  for (const h of hints) hashes.add(h.ruleset_hash);
  for (const f of facts) hashes.add(f.ruleset_hash);
  return hashes;
}

function getRelevantHashes(
  hints: ConversationHint[],
  facts: ConversationFact[],
  hintTypes: string[],
  factKeys: string[],
): Set<string> {
  const hashes = new Set<string>();
  for (const h of hints) {
    if (hintTypes.includes(h.hint_type)) hashes.add(h.ruleset_hash);
  }
  for (const f of facts) {
    if (factKeys.includes(f.fact_key)) hashes.add(f.ruleset_hash);
  }
  return hashes;
}

/**
 * Calcula o ruleset_hash para uma classificação.
 *
 * Regras:
 * - Se usar um único hash de hint/fact → herda ele.
 * - Se combinar vários hashes diferentes → ordenar asc, unir por '\n', SHA-256.
 * - Se derivar apenas de signals (sem regras) → 'no_ruleset_v1'.
 */
export function deriveRulesetHash(hashes: Set<string>): string {
  const arr = Array.from(hashes).filter((h) => h !== 'no_ruleset_v1');
  if (arr.length === 0) return 'no_ruleset_v1';
  if (arr.length === 1) return arr[0]!;

  arr.sort();
  const hash = createHash('sha256');
  hash.update(arr.join('\n'));
  return hash.digest('hex');
}

export function classifyConversation(data: ConversationData): ClassificationInput[] {
  const results: ClassificationInput[] = [];
  const { hints, facts } = data;

  // ------------------------------------------------------------------
  // urgency
  // ------------------------------------------------------------------
  if (hasHint(hints, 'urgency_marker')) {
    const hashes = getRelevantHashes(hints, facts, ['urgency_marker'], []);
    results.push({
      dimension: 'urgency',
      value: 'high',
      confidence_level: 0.80,
      ruleset_hash: deriveRulesetHash(hashes),
    });
  }

  // ------------------------------------------------------------------
  // buyer_intent
  // ------------------------------------------------------------------
  if (hasHint(hints, 'positive_marker') && hasFact(facts, 'price_quoted')) {
    const hashes = getRelevantHashes(hints, facts, ['positive_marker'], ['price_quoted']);
    results.push({
      dimension: 'buyer_intent',
      value: 'high',
      confidence_level: 0.85,
      ruleset_hash: deriveRulesetHash(hashes),
    });
  } else if (hasHint(hints, 'positive_marker')) {
    const hashes = getRelevantHashes(hints, facts, ['positive_marker'], []);
    results.push({
      dimension: 'buyer_intent',
      value: 'medium',
      confidence_level: 0.65,
      ruleset_hash: deriveRulesetHash(hashes),
    });
  } else if (hasHint(hints, 'price_complaint')) {
    const hashes = getRelevantHashes(hints, facts, ['price_complaint'], []);
    results.push({
      dimension: 'buyer_intent',
      value: 'low',
      confidence_level: 0.60,
      ruleset_hash: deriveRulesetHash(hashes),
    });
  }

  // ------------------------------------------------------------------
  // stage_reached
  // ------------------------------------------------------------------
  if (hasHint(hints, 'positive_marker') && hasFact(facts, 'price_quoted')) {
    const hashes = getRelevantHashes(hints, facts, ['positive_marker'], ['price_quoted']);
    results.push({
      dimension: 'stage_reached',
      value: 'purchase_intent',
      confidence_level: 0.85,
      ruleset_hash: deriveRulesetHash(hashes),
    });
  } else if (hasFact(facts, 'price_quoted')) {
    const hashes = getRelevantHashes(hints, facts, [], ['price_quoted']);
    results.push({
      dimension: 'stage_reached',
      value: 'quote_sent',
      confidence_level: 0.80,
      ruleset_hash: deriveRulesetHash(hashes),
    });
  }

  // ------------------------------------------------------------------
  // loss_reason
  // ------------------------------------------------------------------
  if (hasHint(hints, 'competitor_mention')) {
    const hashes = getRelevantHashes(hints, facts, ['competitor_mention'], []);
    results.push({
      dimension: 'loss_reason',
      value: 'competitor',
      confidence_level: 0.80,
      ruleset_hash: deriveRulesetHash(hashes),
    });
  } else if (hasHint(hints, 'price_complaint') && !hasHint(hints, 'positive_marker')) {
    const hashes = getRelevantHashes(hints, facts, ['price_complaint'], []);
    results.push({
      dimension: 'loss_reason',
      value: 'price',
      confidence_level: 0.75,
      ruleset_hash: deriveRulesetHash(hashes),
    });
  }

  // ------------------------------------------------------------------
  // final_outcome
  // ------------------------------------------------------------------
  if (hasHint(hints, 'positive_marker') && hasFact(facts, 'price_quoted')) {
    const hashes = getRelevantHashes(hints, facts, ['positive_marker'], ['price_quoted']);
    results.push({
      dimension: 'final_outcome',
      value: 'won',
      confidence_level: 0.70,
      ruleset_hash: deriveRulesetHash(hashes),
    });
  } else if (
    (hasHint(hints, 'price_complaint') && hasHint(hints, 'abandonment_marker')) ||
    (hasHint(hints, 'competitor_mention') && hasHint(hints, 'abandonment_marker'))
  ) {
    const hashes = getRelevantHashes(
      hints,
      facts,
      ['price_complaint', 'competitor_mention', 'abandonment_marker'],
      [],
    );
    results.push({
      dimension: 'final_outcome',
      value: 'lost',
      confidence_level: 0.65,
      ruleset_hash: deriveRulesetHash(hashes),
    });
  }

  return results;
}

export async function loadConversationData(
  client: PoolClient,
  conversationId: string,
  environment: string,
): Promise<ConversationData> {
  const signalsResult = await client.query<ConversationSignals>(
    `SELECT total_messages, contact_messages, agent_messages,
            first_response_seconds, max_gap_seconds
     FROM analytics.conversation_signals
     WHERE conversation_id = $1 AND environment = $2`,
    [conversationId, environment],
  );

  const hintsResult = await client.query<ConversationHint>(
    `SELECT hint_type, ruleset_hash
     FROM analytics.linguistic_hints
     WHERE conversation_id = $1 AND environment = $2`,
    [conversationId, environment],
  );

  const factsResult = await client.query<ConversationFact>(
    `SELECT fact_key, ruleset_hash
     FROM analytics.conversation_facts
     WHERE conversation_id = $1 AND environment = $2`,
    [conversationId, environment],
  );

  return {
    signals: signalsResult.rows[0] ?? null,
    hints: hintsResult.rows,
    facts: factsResult.rows,
  };
}

export async function enrichClassifications(
  client: PoolClient,
  conversationId: string,
  environment: string,
): Promise<ClassificationInput[]> {
  const data = await loadConversationData(client, conversationId, environment);
  return classifyConversation(data);
}
