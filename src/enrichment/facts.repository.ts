import type { PoolClient } from 'pg';
import type { Fact } from './rules.types.js';

export async function insertFacts(
  client: PoolClient,
  facts: Fact[],
): Promise<number> {
  if (facts.length === 0) return 0;

  let inserted = 0;

  for (const fact of facts) {
    const result = await client.query(
      `INSERT INTO analytics.conversation_facts (
         environment, conversation_id, fact_key, fact_value, observed_at,
         message_id, truth_type, source, confidence_level, extractor_version, ruleset_hash
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (environment, conversation_id, fact_key, source, extractor_version)
       DO UPDATE SET
         fact_value = EXCLUDED.fact_value,
         ruleset_hash = EXCLUDED.ruleset_hash,
         observed_at = EXCLUDED.observed_at,
         message_id = EXCLUDED.message_id,
         confidence_level = EXCLUDED.confidence_level`,
      [
        fact.environment,
        fact.conversation_id,
        fact.fact_key,
        JSON.stringify(fact.fact_value),
        fact.observed_at,
        fact.message_id,
        fact.truth_type,
        fact.source,
        fact.confidence_level,
        fact.extractor_version,
        fact.ruleset_hash,
      ],
    );

    inserted += result.rowCount ?? 0;
  }

  return inserted;
}
