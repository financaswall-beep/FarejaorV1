import { describe, it, expect } from 'vitest';
import { mapAttachment } from '../../../src/normalization/attachment.mapper.js';
import messageWithAttachment from '../../fixtures/chatwoot/message_with_attachment.json';

const environment = 'prod';

describe('attachment.mapper', () => {
  it('maps attachment from message_with_attachment fixture', () => {
    const [attPayload] = messageWithAttachment.attachments;
    const result = mapAttachment(attPayload, environment);

    expect(result.environment).toBe('prod');
    expect(result.chatwootAttachmentId).toBe(3001);
    expect(result.chatwootMessageId).toBe(1002);
    expect(result.fileType).toBe('image');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.dataUrl).toBe('https://chatwoot.example.test/rails/active_storage/blobs/test-image.jpg');
    expect(result.fileSizeBytes).toBe(12345);
  });
});
