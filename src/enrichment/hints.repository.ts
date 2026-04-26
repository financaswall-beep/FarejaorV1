import type { PoolClient } from 'pg';
import type { Hint } from './rules.types.js';

export async function insertHints(
  client: PoolClient,
  hints: Hint[],
): Promise<number> {
  if (hints.length === 0) return 0;

  let inserted = 0;

  for (const hint of hints) {
    const result = await client.query(
      `INSERT INTO analytics.linguistic_hints (
         environment, conversation_id, message_id, hint_type, matched_text,
         pattern_id, truth_type, source, confidence_level, extractor_version, ruleset_hash
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT ON CONSTRAINT hints_dedup_key DO NOTHING`,
      [
        hint.environment,
        hint.conversation_id,
        hint.message_id,
        hint.hint_type,
        hint.matched_text,
        hint.pattern_id,
        hint.truth_type,
        hint.source,
        hint.confidence_level,
        hint.extractor_version,
        hint.ruleset_hash,
      ],
    );

    inserted += result.rowCount ?? 0;
  }

  return inserted;
}
