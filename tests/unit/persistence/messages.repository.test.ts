import { describe, expect, it, vi } from 'vitest';
import { upsertMessage } from '../../../src/persistence/messages.repository.js';
import type { MappedMessage } from '../../../src/normalization/message.mapper.js';

function createMessage(overrides: Partial<MappedMessage> = {}): MappedMessage {
  const sentAt = new Date('2026-04-23T12:00:00Z');
  return {
    environment: 'prod',
    chatwootMessageId: 1001,
    chatwootAccountId: 1,
    chatwootInboxId: 5,
    chatwootConversationId: 101,
    senderType: 'contact',
    senderId: 201,
    messageType: 0,
    content: 'TEST MESSAGE 1',
    contentType: 'text',
    contentAttributes: {},
    isPrivate: false,
    status: 'sent',
    externalSourceIds: {},
    echoId: null,
    sentAt,
    lastEventAt: sentAt,
    ...overrides,
  };
}

describe('messages.repository', () => {
  it('creates a minimal parent conversation before inserting a message', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'message-uuid', conversation_id: 'conversation-uuid' }],
      }),
    };

    await upsertMessage(client as never, createMessage());

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('WITH ensured_conversation AS');
    expect(sql).toContain('INSERT INTO core.conversations');
    expect(sql).toContain("VALUES ($1, $3, $16, $17, 'open', $14, NULL)");
    expect(sql).toContain('existing_message AS');
    expect(sql).toContain('WHERE environment = $1');
    expect(sql).toContain('AND chatwoot_message_id = $2');
    expect(sql).toContain('INSERT INTO core.messages');
    expect(sql).toContain('WHERE NOT EXISTS (SELECT 1 FROM existing_message)');
    expect(sql).toContain('RETURNING id, conversation_id');
    expect(sql).not.toContain('updated_at = now()');
    expect(params[15]).toBe(1);
    expect(params[16]).toBe(5);
  });

  it('deduplicates messages by Chatwoot id before considering sent_at precision', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'message-uuid', conversation_id: 'conversation-uuid' }],
      }),
    };

    await upsertMessage(client as never, createMessage());

    const sql = client.query.mock.calls[0][0] as string;
    expect(sql).toContain('existing_message AS');
    expect(sql).toContain('WHERE environment = $1');
    expect(sql).toContain('AND chatwoot_message_id = $2');
    expect(sql).toContain('WHERE NOT EXISTS (SELECT 1 FROM existing_message)');
  });

  it('returns the existing id when a stale upsert does not return rows', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'existing-message-uuid',
              conversation_id: 'existing-conversation-uuid',
            },
          ],
        }),
    };

    await expect(upsertMessage(client as never, createMessage())).resolves.toEqual({
      messageId: 'existing-message-uuid',
      conversationId: 'existing-conversation-uuid',
    });

    expect(client.query.mock.calls[1][0]).toContain('SELECT id, conversation_id');
    expect(client.query.mock.calls[1][0]).toContain('FROM core.messages');
  });
});
