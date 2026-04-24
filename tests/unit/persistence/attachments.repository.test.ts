import { describe, expect, it, vi } from 'vitest';
import { upsertAttachment } from '../../../src/persistence/attachments.repository.js';
import type { MappedAttachment } from '../../../src/normalization/attachment.mapper.js';

function createAttachment(): MappedAttachment {
  return {
    environment: 'prod',
    chatwootAttachmentId: 3001,
    chatwootMessageId: 1002,
    fileType: 'image',
    mimeType: 'image/jpeg',
    fileSizeBytes: 12345,
    dataUrl: 'https://chatwoot.example.test/rails/active_storage/blobs/test-image.jpg',
    thumbUrl: 'https://chatwoot.example.test/rails/active_storage/representations/test-image.jpg',
    coordinatesLat: null,
    coordinatesLng: null,
  };
}

describe('attachments.repository', () => {
  it('uses the conversation UUID supplied by message upsert instead of a subselect', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    await upsertAttachment(
      client as never,
      createAttachment(),
      'message-uuid',
      'conversation-uuid',
    );

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO core.message_attachments');
    expect(sql).not.toContain('SELECT id FROM core.conversations');
    expect(params[2]).toBe('message-uuid');
    expect(params[3]).toBe('conversation-uuid');
  });
});
