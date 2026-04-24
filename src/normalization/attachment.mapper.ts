import type { ChatwootAttachment } from '../shared/types/chatwoot.js';

export interface MappedAttachment {
  environment: string;
  chatwootAttachmentId: number;
  chatwootMessageId: number;
  fileType: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  dataUrl: string | null;
  thumbUrl: string | null;
  coordinatesLat: number | null;
  coordinatesLng: number | null;
}

export function mapAttachment(
  payload: unknown,
  environment: string,
): MappedAttachment {
  const p = payload as ChatwootAttachment;

  return {
    environment,
    chatwootAttachmentId: p.id,
    chatwootMessageId: p.message_id ?? 0,
    fileType: p.file_type,
    mimeType: p.mime_type ?? null,
    fileSizeBytes: p.file_size ?? null,
    dataUrl: p.data_url ?? null,
    thumbUrl: p.thumb_url ?? null,
    coordinatesLat: p.coordinates_lat ?? null,
    coordinatesLng: p.coordinates_long ?? null,
  };
}
