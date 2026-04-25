import type { PoolClient } from 'pg';
import type { MappedStatusEvent } from '../normalization/status-event.mapper.js';

export async function insertStatusEvent(
  client: PoolClient,
  event: MappedStatusEvent,
  conversationId: string,
): Promise<void> {
  await client.query(
    `WITH input AS (
      SELECT
        $1::env_t AS environment,
        $2::uuid AS conversation_id,
        $3::bigint AS chatwoot_conversation_id,
        $4::text AS event_type,
        $5::text AS from_value,
        $6::text AS to_value,
        $7::bigint AS changed_by_id,
        $8::text AS changed_by_type,
        $9::timestamptz AS occurred_at,
        $10::bigint AS raw_event_id
    )
    INSERT INTO core.conversation_status_events (
      environment, conversation_id, chatwoot_conversation_id, event_type,
      from_value, to_value, changed_by_id, changed_by_type, occurred_at, raw_event_id
    )
    SELECT
      environment, conversation_id, chatwoot_conversation_id, event_type,
      from_value, to_value, changed_by_id, changed_by_type, occurred_at, raw_event_id
    FROM input
    WHERE NOT EXISTS (
      SELECT 1
      FROM core.conversation_status_events
      WHERE environment = input.environment
        AND conversation_id = input.conversation_id
        AND chatwoot_conversation_id = input.chatwoot_conversation_id
        AND event_type = input.event_type
        AND from_value IS NOT DISTINCT FROM input.from_value
        AND to_value IS NOT DISTINCT FROM input.to_value
        AND occurred_at = input.occurred_at
        AND raw_event_id IS NOT DISTINCT FROM input.raw_event_id
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
