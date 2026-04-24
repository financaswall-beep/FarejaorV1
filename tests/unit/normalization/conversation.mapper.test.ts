import { describe, it, expect } from 'vitest';
import { mapConversation } from '../../../src/normalization/conversation.mapper.js';
import conversationCreated from '../../fixtures/chatwoot/conversation_created.json';
import conversationUpdated from '../../fixtures/chatwoot/conversation_updated.json';
import conversationStatusChanged from '../../fixtures/chatwoot/conversation_status_changed.json';

const environment = 'prod';
const lastEventAt = new Date('2026-04-23T12:00:00Z');

describe('conversation.mapper', () => {
  it('maps conversation_created fixture correctly', () => {
    const result = mapConversation(conversationCreated, environment, lastEventAt);

    expect(result.environment).toBe('prod');
    expect(result.chatwootConversationId).toBe(101);
    expect(result.chatwootAccountId).toBe(1);
    expect(result.currentStatus).toBe('open');
    expect(result.chatwootContactId).toBe(201);
    expect(result.startedAt.toISOString()).toBe('2026-04-23T12:00:00.000Z');
    expect(result.resolvedAt).toBeNull();
    expect(result.lastEventAt).toEqual(lastEventAt);
  });

  it('maps conversation_updated fixture with resolved status', () => {
    const result = mapConversation(conversationUpdated, environment, lastEventAt);

    expect(result.chatwootConversationId).toBe(101);
    expect(result.currentStatus).toBe('resolved');
    expect(result.currentAssigneeId).toBe(42);
    expect(result.currentTeamId).toBe(3);
    expect(result.priority).toBe('high');
    expect(result.resolvedAt?.toISOString()).toBe('2026-04-23T12:05:00.000Z');
  });

  it('maps conversation_status_changed fixture correctly', () => {
    const result = mapConversation(conversationStatusChanged, environment, lastEventAt);

    expect(result.chatwootConversationId).toBe(101);
    expect(result.currentStatus).toBe('pending');
    expect(result.resolvedAt).toBeNull();
  });
});
