import type { PoolClient } from 'pg';
import type { MappedConversation } from '../normalization/conversation.mapper.js';

export async function upsertConversation(
  client: PoolClient,
  conversation: MappedConversation,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO core.conversations (
      environment, chatwoot_conversation_id, chatwoot_account_id, chatwoot_inbox_id,
      channel_type, contact_id, current_status, current_assignee_id, current_team_id,
      priority, started_at, first_reply_at, last_activity_at, resolved_at, waiting_since,
      message_count_cache, additional_attributes, custom_attributes, last_event_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      (SELECT id FROM core.contacts WHERE environment = $1 AND chatwoot_contact_id = $6),
      $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
    )
    ON CONFLICT (environment, chatwoot_conversation_id) DO UPDATE
    SET chatwoot_account_id = EXCLUDED.chatwoot_account_id,
        chatwoot_inbox_id = EXCLUDED.chatwoot_inbox_id,
        channel_type = EXCLUDED.channel_type,
        contact_id = EXCLUDED.contact_id,
        current_status = EXCLUDED.current_status,
        current_assignee_id = EXCLUDED.current_assignee_id,
        current_team_id = EXCLUDED.current_team_id,
        priority = EXCLUDED.priority,
        started_at = EXCLUDED.started_at,
        first_reply_at = EXCLUDED.first_reply_at,
        last_activity_at = EXCLUDED.last_activity_at,
        resolved_at = EXCLUDED.resolved_at,
        waiting_since = EXCLUDED.waiting_since,
        message_count_cache = EXCLUDED.message_count_cache,
        additional_attributes = EXCLUDED.additional_attributes,
        custom_attributes = EXCLUDED.custom_attributes,
        last_event_at = EXCLUDED.last_event_at,
        updated_at = now()
    WHERE core.conversations.last_event_at IS NULL
       OR EXCLUDED.last_event_at >= core.conversations.last_event_at
    RETURNING id`,
    [
      conversation.environment,
      conversation.chatwootConversationId,
      conversation.chatwootAccountId,
      conversation.chatwootInboxId,
      conversation.channelType,
      conversation.chatwootContactId,
      conversation.currentStatus,
      conversation.currentAssigneeId,
      conversation.currentTeamId,
      conversation.priority,
      conversation.startedAt,
      null,
      conversation.lastActivityAt,
      conversation.resolvedAt,
      conversation.waitingSince,
      0,
      JSON.stringify(conversation.additionalAttributes),
      JSON.stringify(conversation.customAttributes),
      conversation.lastEventAt,
    ],
  );

  const returnedId = result.rows[0]?.id;
  if (returnedId) {
    return returnedId;
  }

  const existing = await client.query<{ id: string }>(
    `SELECT id
     FROM core.conversations
     WHERE environment = $1
       AND chatwoot_conversation_id = $2`,
    [conversation.environment, conversation.chatwootConversationId],
  );

  const existingId = existing.rows[0]?.id;
  if (!existingId) {
    throw new Error(`core.conversations id not found for chatwoot_conversation_id=${conversation.chatwootConversationId}`);
  }

  return existingId;
}
