import type { PoolClient } from 'pg';
import type { MappedTag } from '../normalization/tag.mapper.js';

export async function upsertTags(
  client: PoolClient,
  tags: MappedTag[],
  conversationId: string,
): Promise<void> {
  for (const tag of tags) {
    await client.query(
      `INSERT INTO core.conversation_tags (
        environment, conversation_id, label, added_at, added_by_type
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (environment, conversation_id, label) DO NOTHING`,
      [
        tag.environment,
        conversationId,
        tag.label,
        tag.addedAt,
        tag.addedByType,
      ],
    );
  }
}
