import type { PoolClient } from 'pg';
import type { ClassificationInput } from './classification.service.js';

export async function upsertClassifications(
  client: PoolClient,
  conversationId: string,
  environment: string,
  classifications: ClassificationInput[],
): Promise<number> {
  if (classifications.length === 0) return 0;

  let inserted = 0;

  for (const c of classifications) {
    const result = await client.query(
      `INSERT INTO analytics.conversation_classifications (
         environment, conversation_id, dimension, value, truth_type,
         source, confidence_level, extractor_version, ruleset_hash, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT ON CONSTRAINT classifications_dedup_key
       DO UPDATE SET
         value = EXCLUDED.value,
         confidence_level = EXCLUDED.confidence_level,
         notes = EXCLUDED.notes`,
      [
        environment,
        conversationId,
        c.dimension,
        c.value,
        'inferred',
        'deterministic_classification_v1',
        c.confidence_level,
        'f2a_classification_v1',
        c.ruleset_hash,
        c.notes ?? null,
      ],
    );

    inserted += result.rowCount ?? 0;
  }

  return inserted;
}
