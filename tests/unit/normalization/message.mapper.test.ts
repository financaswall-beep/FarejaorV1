import { describe, it, expect } from 'vitest';
import { mapMessage } from '../../../src/normalization/message.mapper.js';
import messageCreated from '../../fixtures/chatwoot/message_created.json';
import messageUpdated from '../../fixtures/chatwoot/message_updated.json';
import messageWithAttachment from '../../fixtures/chatwoot/message_with_attachment.json';

const environment = 'prod';
const lastEventAt = new Date('2026-04-23T12:00:00Z');

describe('message.mapper', () => {
  it('maps message_created fixture correctly', () => {
    const result = mapMessage(messageCreated, environment, lastEventAt);

    expect(result.environment).toBe('prod');
    expect(result.chatwootMessageId).toBe(1001);
    expect(result.chatwootConversationId).toBe(101);
    expect(result.content).toBe('TEST MESSAGE 1');
    expect(result.messageType).toBe(0);
    expect(result.senderType).toBe('contact');
    expect(result.senderId).toBe(201);
    expect(result.isPrivate).toBe(false);
    expect(result.sentAt.toISOString()).toBe('2026-04-23T12:00:00.000Z');
  });

  it('normalizes sender_type "Contact" to lowercase "contact"', () => {
    const result = mapMessage(messageCreated, environment, lastEventAt);
    expect(result.senderType).toBe('contact');
  });

  it('falls back to system when sender_type is missing or invalid', () => {
    const missingSenderType = { ...messageCreated, sender_type: undefined };
    const invalidSenderType = { ...messageCreated, sender_type: 'external_bot' };

    expect(mapMessage(missingSenderType, environment, lastEventAt).senderType).toBe(
      'system',
    );
    expect(mapMessage(invalidSenderType, environment, lastEventAt).senderType).toBe(
      'system',
    );
  });

  it('handles empty sender object using sender_id fallback', () => {
    const result = mapMessage(messageCreated, environment, lastEventAt);
    expect(result.senderId).toBe(201);
  });

  it('maps message_updated fixture correctly', () => {
    const result = mapMessage(messageUpdated, environment, lastEventAt);

    expect(result.chatwootMessageId).toBe(1001);
    expect(result.content).toBe('TEST MESSAGE 1 UPDATED');
    expect(result.sentAt.toISOString()).toBe('2026-04-23T12:00:00.000Z');
  });

  it('maps message_with_attachment fixture correctly', () => {
    const result = mapMessage(messageWithAttachment, environment, lastEventAt);

    expect(result.chatwootMessageId).toBe(1002);
    expect(result.content).toBeNull();
    expect(result.senderType).toBe('contact');
    expect(result.senderId).toBe(201);
  });

  it('falls back to lastEventAt when created_at is missing', () => {
    const payload = { ...messageCreated, created_at: undefined };
    const result = mapMessage(payload, environment, lastEventAt);
    expect(result.sentAt).toEqual(lastEventAt);
  });

  it('reads conversation id and sender type from nested real Chatwoot payload fields', () => {
    const payload = {
      ...messageCreated,
      conversation_id: undefined,
      sender_type: undefined,
      sender_id: undefined,
      conversation: { id: 303 },
      sender: { id: 404, type: 'contact' },
    };

    const result = mapMessage(payload, environment, lastEventAt);

    expect(result.chatwootConversationId).toBe(303);
    expect(result.senderType).toBe('contact');
    expect(result.senderId).toBe(404);
  });
});
