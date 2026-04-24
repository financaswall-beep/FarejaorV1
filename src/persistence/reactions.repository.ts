import type { PoolClient } from 'pg';
import type { MappedReaction } from '../normalization/reaction.mapper.js';

export async function insertReaction(
  client: PoolClient,
  reaction: MappedReaction,
  messageId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO core.message_reactions (
      environment, message_id, reactor_type, reactor_id, emoji, reacted_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (environment, message_id, reactor_type, reactor_id, emoji) DO NOTHING`,
    [
      reaction.environment,
      messageId,
      reaction.reactorType,
      reaction.reactorId,
      reaction.emoji,
      reaction.reactedAt,
    ],
  );
}
