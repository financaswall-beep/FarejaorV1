import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReconcileChatwootClient } from '../../../src/admin/reconcile.service.js';

const baseEnv = {
  NODE_ENV: 'test',
  FAREJADOR_ENV: 'prod',
  DATABASE_URL: 'postgresql://postgres:password@example.test:6543/postgres',
  CHATWOOT_HMAC_SECRET: 'test-secret',
  ADMIN_AUTH_TOKEN: 'test-admin-token',
  CHATWOOT_ACCOUNT_ID: '1',
};

function createPool() {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
  return {
    connect: vi.fn().mockResolvedValue(client),
    client,
  };
}

async function loadReconcile() {
  vi.resetModules();
  Object.assign(process.env, baseEnv);
  vi.doMock('pino', () => ({
    default: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  }));

  return import('../../../src/admin/reconcile.service.js');
}

function createConversation(id: number, updatedAt = '2024-04-24T23:06:40Z') {
  return {
    id,
    account_id: 1,
    updated_at: updatedAt,
  };
}

function createMessage(id: number, conversationId: number, createdAt = '2024-04-24T23:06:40Z') {
  return {
    id,
    conversation_id: conversationId,
    account_id: 1,
    created_at: createdAt,
    message_type: 0,
  };
}

describe('reconcile service', () => {
  afterEach(() => {
    vi.doUnmock('pino');
    vi.resetModules();
  });

  it('inserts one conversation event and all message events', async () => {
    const { reconcile } = await loadReconcile();
    const pool = createPool();
    const chatwootClient: ReconcileChatwootClient = {
      listConversations: vi.fn().mockResolvedValue({
        items: [createConversation(1), createConversation(2)],
        hasMore: false,
        page: 1,
      }),
      listMessages: vi.fn(({ conversationId }) => ({
        items: [
          createMessage(conversationId * 10 + 1, conversationId),
          createMessage(conversationId * 10 + 2, conversationId),
          createMessage(conversationId * 10 + 3, conversationId),
        ],
        hasMore: false,
        page: 1,
      })),
    };
    const insertRawEvent = vi.fn().mockResolvedValue(1);

    const result = await reconcile(
      {
        since: new Date('2026-04-20T00:00:00Z'),
        until: new Date('2026-04-24T00:00:00Z'),
        environment: 'prod',
      },
      {
        chatwootClient,
        pool: pool as never,
        insertRawEvent,
      },
    );

    expect(result.inserted).toBe(8);
    expect(result.skipped_duplicate).toBe(0);
    expect(insertRawEvent).toHaveBeenCalledTimes(8);
  });

  it('skips duplicates on a second run with the same deterministic delivery ids', async () => {
    const { reconcile } = await loadReconcile();
    const pool = createPool();
    const seen = new Set<string>();
    const chatwootClient: ReconcileChatwootClient = {
      listConversations: vi.fn().mockResolvedValue({
        items: [createConversation(123)],
        hasMore: false,
        page: 1,
      }),
      listMessages: vi.fn().mockResolvedValue({
        items: [createMessage(456, 123)],
        hasMore: false,
        page: 1,
      }),
    };
    const insertRawEvent = vi.fn((_client, input: { chatwootDeliveryId: string }) => {
      if (seen.has(input.chatwootDeliveryId)) return Promise.resolve(null);
      seen.add(input.chatwootDeliveryId);
      return Promise.resolve(seen.size);
    });
    const input = {
      since: new Date('2026-04-20T00:00:00Z'),
      until: new Date('2026-04-24T00:00:00Z'),
      environment: 'prod' as const,
    };

    const first = await reconcile(input, { chatwootClient, pool: pool as never, insertRawEvent });
    const second = await reconcile(input, { chatwootClient, pool: pool as never, insertRawEvent });

    expect(first.inserted).toBe(2);
    expect(second.inserted).toBe(0);
    expect(second.skipped_duplicate).toBe(2);
  });

  it('continues processing when one insert fails', async () => {
    const { reconcile } = await loadReconcile();
    const pool = createPool();
    const chatwootClient: ReconcileChatwootClient = {
      listConversations: vi.fn().mockResolvedValue({
        items: [createConversation(1), createConversation(2)],
        hasMore: false,
        page: 1,
      }),
      listMessages: vi.fn().mockResolvedValue({ items: [], hasMore: false, page: 1 }),
    };
    const insertRawEvent = vi
      .fn()
      .mockRejectedValueOnce(new Error('insert failed'))
      .mockResolvedValue(2);

    const result = await reconcile(
      {
        since: new Date('2026-04-20T00:00:00Z'),
        until: new Date('2026-04-24T00:00:00Z'),
        environment: 'prod',
      },
      { chatwootClient, pool: pool as never, insertRawEvent },
    );

    expect(result.inserted).toBe(1);
    expect(result.errors).toEqual([{ chatwoot_conversation_id: 1, reason: 'insert failed' }]);
  });

  it('fetches all conversation pages', async () => {
    const { reconcile } = await loadReconcile();
    const pool = createPool();
    const chatwootClient: ReconcileChatwootClient = {
      listConversations: vi
        .fn()
        .mockResolvedValueOnce({ items: [], hasMore: true, page: 1 })
        .mockResolvedValueOnce({ items: [], hasMore: true, page: 2 })
        .mockResolvedValueOnce({ items: [], hasMore: false, page: 3 }),
      listMessages: vi.fn(),
    };

    const result = await reconcile(
      {
        since: new Date('2026-04-20T00:00:00Z'),
        until: new Date('2026-04-24T00:00:00Z'),
        environment: 'prod',
      },
      { chatwootClient, pool: pool as never, insertRawEvent: vi.fn() },
    );

    expect(chatwootClient.listConversations).toHaveBeenCalledTimes(3);
    expect(result.pages_fetched).toBe(3);
  });

  it('builds deterministic delivery ids for conversations and messages', async () => {
    const { reconcile } = await loadReconcile();
    const pool = createPool();
    const chatwootClient: ReconcileChatwootClient = {
      listConversations: vi.fn().mockResolvedValue({
        items: [createConversation(123)],
        hasMore: false,
        page: 1,
      }),
      listMessages: vi.fn().mockResolvedValue({
        items: [createMessage(456, 123)],
        hasMore: false,
        page: 1,
      }),
    };
    const insertRawEvent = vi.fn().mockResolvedValue(1);

    await reconcile(
      {
        since: new Date('2026-04-20T00:00:00Z'),
        until: new Date('2026-04-24T00:00:00Z'),
        environment: 'prod',
      },
      { chatwootClient, pool: pool as never, insertRawEvent },
    );

    expect(insertRawEvent.mock.calls[0]?.[1].chatwootDeliveryId).toBe(
      'reconcile:conv:prod:123:1714000000',
    );
    expect(insertRawEvent.mock.calls[0]?.[1].environment).toBe('prod');
    expect(insertRawEvent.mock.calls[1]?.[1].chatwootDeliveryId).toBe(
      'reconcile:msg:prod:456:1714000000',
    );
    expect(insertRawEvent.mock.calls[1]?.[1].environment).toBe('prod');
  });

  it('records an item error when a message is missing created_at', async () => {
    const { reconcile } = await loadReconcile();
    const pool = createPool();
    const chatwootClient: ReconcileChatwootClient = {
      listConversations: vi.fn().mockResolvedValue({
        items: [createConversation(123)],
        hasMore: false,
        page: 1,
      }),
      listMessages: vi.fn().mockResolvedValue({
        items: [{ id: 456, conversation_id: 123 }],
        hasMore: false,
        page: 1,
      }),
    };

    const result = await reconcile(
      {
        since: new Date('2026-04-20T00:00:00Z'),
        until: new Date('2026-04-24T00:00:00Z'),
        environment: 'prod',
      },
      { chatwootClient, pool: pool as never, insertRawEvent: vi.fn().mockResolvedValue(1) },
    );

    expect(result.errors).toEqual([
      { chatwoot_conversation_id: 123, reason: 'invalid message payload' },
    ]);
  });
});
