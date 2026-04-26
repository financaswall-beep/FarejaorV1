import type { PoolClient } from 'pg';

export async function computeAndUpsertSignals(
  client: PoolClient,
  conversationId: string,
  environment: string,
): Promise<boolean> {
  const result = await client.query(
    `WITH conversation_ref AS (
       SELECT id, started_at, environment
       FROM core.conversations
       WHERE id = $1 AND environment = $2
     ),
     messages_agg AS (
       SELECT
         conversation_id,
         COUNT(*) AS total_messages,
         COUNT(*) FILTER (WHERE sender_type = 'contact') AS contact_messages,
         COUNT(*) FILTER (WHERE sender_type = 'user') AS agent_messages,
         COUNT(*) FILTER (WHERE sender_type = 'agent_bot') AS bot_messages,
         MIN(sent_at) AS first_message_at,
         MAX(sent_at) AS last_message_at
       FROM core.messages
       WHERE conversation_id = $1 AND environment = $2 AND is_private = false
       GROUP BY conversation_id
     ),
     media_agg AS (
       SELECT COUNT(DISTINCT message_id) AS media_message_count
       FROM core.message_attachments
       WHERE conversation_id = $1 AND environment = $2
     ),
     first_response AS (
       SELECT EXTRACT(EPOCH FROM (a.sent_at - c.sent_at))::INTEGER AS first_response_seconds
       FROM (
         SELECT sent_at FROM core.messages
         WHERE conversation_id = $1 AND environment = $2 AND is_private = false AND sender_type = 'user'
         ORDER BY sent_at ASC LIMIT 1
       ) a,
       (
         SELECT sent_at FROM core.messages
         WHERE conversation_id = $1 AND environment = $2 AND is_private = false AND sender_type = 'contact'
         ORDER BY sent_at ASC LIMIT 1
       ) c
       WHERE a.sent_at > c.sent_at
     ),
     agent_response_times AS (
       SELECT AVG(EXTRACT(EPOCH FROM (agent.sent_at - prev_contact.sent_at)))::INTEGER AS avg_agent_response_sec
       FROM core.messages agent
       JOIN LATERAL (
         SELECT sent_at, sender_type
         FROM core.messages
         WHERE conversation_id = $1 AND environment = $2 AND is_private = false AND sent_at < agent.sent_at
         ORDER BY sent_at DESC LIMIT 1
       ) prev_contact ON true
       WHERE agent.conversation_id = $1 AND agent.environment = $2 AND agent.is_private = false AND agent.sender_type = 'user'
         AND prev_contact.sender_type = 'contact'
     ),
     message_gaps AS (
       SELECT MAX(EXTRACT(EPOCH FROM (m2.sent_at - m1.sent_at)))::INTEGER AS max_gap_seconds
       FROM core.messages m2
       JOIN LATERAL (
         SELECT sent_at
         FROM core.messages
         WHERE conversation_id = $1 AND environment = $2 AND is_private = false AND sent_at < m2.sent_at
         ORDER BY sent_at DESC LIMIT 1
       ) m1 ON true
       WHERE m2.conversation_id = $1 AND m2.environment = $2 AND m2.is_private = false
     ),
     handoffs AS (
       SELECT MAX(handoff_number) AS handoff_count
       FROM core.conversation_assignments
       WHERE conversation_id = $1 AND environment = $2
     )
     INSERT INTO analytics.conversation_signals (
       conversation_id, environment, total_messages, contact_messages, agent_messages, bot_messages,
       media_message_count, media_text_ratio, first_response_seconds, avg_agent_response_sec,
       max_gap_seconds, total_duration_seconds, handoff_count, started_hour_local, started_dow_local,
       computed_at, extractor_version, source, truth_type, confidence_level
     )
     SELECT
       cr.id,
       cr.environment,
       COALESCE(ma.total_messages, 0),
       COALESCE(ma.contact_messages, 0),
       COALESCE(ma.agent_messages, 0),
       COALESCE(ma.bot_messages, 0),
       COALESCE(me.media_message_count, 0),
       CASE WHEN ma.total_messages > 0 THEN ROUND(COALESCE(me.media_message_count, 0)::NUMERIC / ma.total_messages, 4) ELSE NULL END,
       fr.first_response_seconds,
       art.avg_agent_response_sec,
       mg.max_gap_seconds,
       CASE WHEN ma.total_messages > 1 THEN EXTRACT(EPOCH FROM (ma.last_message_at - ma.first_message_at))::INTEGER ELSE NULL END,
       COALESCE(h.handoff_count, 0)::SMALLINT,
       EXTRACT(HOUR FROM cr.started_at AT TIME ZONE 'America/Sao_Paulo')::SMALLINT,
       EXTRACT(DOW FROM cr.started_at AT TIME ZONE 'America/Sao_Paulo')::SMALLINT,
       now(),
       'f2a_signals_v1',
       'sql_aggregation_v1',
       'observed',
       1.00
     FROM conversation_ref cr
     LEFT JOIN messages_agg ma ON true
     LEFT JOIN media_agg me ON true
     LEFT JOIN first_response fr ON true
     LEFT JOIN agent_response_times art ON true
     LEFT JOIN message_gaps mg ON true
     LEFT JOIN handoffs h ON true
     ON CONFLICT (conversation_id) DO UPDATE
     SET
       environment = EXCLUDED.environment,
       total_messages = EXCLUDED.total_messages,
       contact_messages = EXCLUDED.contact_messages,
       agent_messages = EXCLUDED.agent_messages,
       bot_messages = EXCLUDED.bot_messages,
       media_message_count = EXCLUDED.media_message_count,
       media_text_ratio = EXCLUDED.media_text_ratio,
       first_response_seconds = EXCLUDED.first_response_seconds,
       avg_agent_response_sec = EXCLUDED.avg_agent_response_sec,
       max_gap_seconds = EXCLUDED.max_gap_seconds,
       total_duration_seconds = EXCLUDED.total_duration_seconds,
       handoff_count = EXCLUDED.handoff_count,
       started_hour_local = EXCLUDED.started_hour_local,
       started_dow_local = EXCLUDED.started_dow_local,
       computed_at = EXCLUDED.computed_at,
       extractor_version = EXCLUDED.extractor_version,
       source = EXCLUDED.source,
       truth_type = EXCLUDED.truth_type,
       confidence_level = EXCLUDED.confidence_level
     RETURNING conversation_id`,
    [conversationId, environment],
  );

  return (result.rowCount ?? 0) > 0;
}
