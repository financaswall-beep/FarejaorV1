import type { PoolClient } from 'pg';
import type { MappedStatusEvent } from '../normalization/status-event.mapper.js';

export async function insertStatusEvent(
  client: PoolClient,
  event: MappedStatusEvent,
  conversationId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO core.conversation_status_events (
      environment, conversation_id, chatwoot_conversation_id, event_type,
      from_value, to_value, changed_by_id, changed_by_type, occurred_at, raw_event_id
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
    WHERE NOT EXISTS (
      SELECT 1
      FROM core.conversation_status_events
      WHERE environment = $1
        AND conversation_id = $2
        AND chatwoot_conversation_id = $3
        AND event_type = $4
        AND from_value IS NOT DISTINCT FROM $5
        AND to_value IS NOT DISTINCT FROM $6
        AND occurred_at = $9
        AND raw_event_id IS NOT DISTINCT FROM $10
    )`,
    [
      event.environment,
      conversationId,
      event.chatwootConversationId,
      event.eventType,
      event.fromValue,
      event.toValue,
      event.changedById,
      event.changedByType,
      event.occurredAt,
      event.rawEventId,
    ],
  );
}
