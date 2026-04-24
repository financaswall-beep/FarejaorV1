import type { PoolClient } from 'pg';
import type { MappedMessage } from '../normalization/message.mapper.js';

export async function upsertMessage(
  client: PoolClient,
  message: MappedMessage,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `WITH ensured_conversation AS (
      INSERT INTO core.conversations (
        environment,
        chatwoot_conversation_id,
        chatwoot_account_id,
        chatwoot_inbox_id,
        current_status,
        started_at,
        last_event_at
      ) VALUES ($1, $3, $16, $17, 'open', $14, NULL)
      ON CONFLICT (environment, chatwoot_conversation_id) DO NOTHING
      RETURNING id
    ),
    conversation_ref AS (
      SELECT id FROM ensured_conversation
      UNION ALL
      SELECT id
      FROM core.conversations
      WHERE environment = $1
        AND chatwoot_conversation_id = $3
      LIMIT 1
    )
    INSERT INTO core.messages (
      environment, chatwoot_message_id, conversation_id, chatwoot_conversation_id,
      sender_type, sender_id, message_type, content, content_type, content_attributes,
      is_private, status, external_source_ids, echo_id, sent_at, last_event_at
    ) VALUES (
      $1, $2,
      (SELECT id FROM conversation_ref),
      $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    )
    ON CONFLICT (environment, chatwoot_message_id, sent_at) DO UPDATE
    SET sender_type = EXCLUDED.sender_type,
        sender_id = EXCLUDED.sender_id,
        message_type = EXCLUDED.message_type,
        content = EXCLUDED.content,
        content_type = EXCLUDED.content_type,
        content_attributes = EXCLUDED.content_attributes,
        is_private = EXCLUDED.is_private,
        status = EXCLUDED.status,
        external_source_ids = EXCLUDED.external_source_ids,
        echo_id = EXCLUDED.echo_id,
        last_event_at = EXCLUDED.last_event_at
    WHERE core.messages.last_event_at IS NULL
       OR EXCLUDED.last_event_at >= core.messages.last_event_at
    RETURNING id`,
    [
      message.environment,
      message.chatwootMessageId,
      message.chatwootConversationId,
      message.senderType,
      message.senderId,
      message.messageType,
      message.content,
      message.contentType,
      JSON.stringify(message.contentAttributes),
      message.isPrivate,
      message.status,
      message.externalSourceIds ? JSON.stringify(message.externalSourceIds) : null,
      message.echoId,
      message.sentAt,
      message.lastEventAt,
      message.chatwootAccountId,
      message.chatwootInboxId,
    ],
  );

  const returnedId = result.rows[0]?.id;
  if (returnedId) {
    return returnedId;
  }

  const existing = await client.query<{ id: string }>(
    `SELECT id
     FROM core.messages
     WHERE environment = $1
       AND chatwoot_message_id = $2
       AND sent_at = $3`,
    [message.environment, message.chatwootMessageId, message.sentAt],
  );

  const existingId = existing.rows[0]?.id;
  if (!existingId) {
    throw new Error(`core.messages id not found for chatwoot_message_id=${message.chatwootMessageId}`);
  }

  return existingId;
}
