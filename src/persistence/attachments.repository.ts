import type { PoolClient } from 'pg';
import type { MappedAttachment } from '../normalization/attachment.mapper.js';

export async function upsertAttachment(
  client: PoolClient,
  attachment: MappedAttachment,
  messageId: string,
  chatwootConversationId: number,
  environment: string,
): Promise<void> {
  await client.query(
    `INSERT INTO core.message_attachments (
      environment, chatwoot_attachment_id, message_id, conversation_id,
      file_type, mime_type, file_size_bytes, data_url, thumb_url,
      coordinates_lat, coordinates_lng
    ) VALUES (
      $1, $2, $3,
      (SELECT id FROM core.conversations WHERE environment = $1 AND chatwoot_conversation_id = $4),
      $5, $6, $7, $8, $9, $10, $11
    )
    ON CONFLICT (environment, chatwoot_attachment_id) DO UPDATE
    SET message_id = EXCLUDED.message_id,
        conversation_id = EXCLUDED.conversation_id,
        file_type = EXCLUDED.file_type,
        mime_type = EXCLUDED.mime_type,
        file_size_bytes = EXCLUDED.file_size_bytes,
        data_url = EXCLUDED.data_url,
        thumb_url = EXCLUDED.thumb_url,
        coordinates_lat = EXCLUDED.coordinates_lat,
        coordinates_lng = EXCLUDED.coordinates_lng`,
    [
      attachment.environment,
      attachment.chatwootAttachmentId,
      messageId,
      chatwootConversationId,
      attachment.fileType,
      attachment.mimeType,
      attachment.fileSizeBytes,
      attachment.dataUrl,
      attachment.thumbUrl,
      attachment.coordinatesLat,
      attachment.coordinatesLng,
    ],
  );
}
