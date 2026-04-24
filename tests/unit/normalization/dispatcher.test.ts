import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const baseEnv = {
  NODE_ENV: 'test',
  FAREJADOR_ENV: 'prod',
  DATABASE_URL: 'postgresql://postgres:password@example.test:6543/postgres',
  CHATWOOT_HMAC_SECRET: 'test-secret',
  CHATWOOT_WEBHOOK_MAX_AGE_SECONDS: '300',
  ADMIN_AUTH_TOKEN: 'test-admin-token',
};

function createMockClient(): {
  query: ReturnType<typeof vi.fn>;
} {
  return {
    query: vi.fn().mockResolvedValue({ rows: [{ id: 'uuid-1' }] }),
  };
}

const environment = 'prod';
const lastEventAt = new Date('2026-04-23T12:00:00Z');

describe('dispatcher', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, baseEnv);
    vi.doMock('pino', () => ({
      default: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      })),
    }));
  });

  afterEach(() => {
    vi.doUnmock('pino');
    vi.resetModules();
  });

  async function loadDispatcher() {
    const mod = await import('../../../src/normalization/dispatcher.js');
    return mod;
  }

  it('dispatches contact_created to contacts repository', async () => {
    const { dispatch } = await loadDispatcher();
    const client = createMockClient();
    const contactCreated = (await import('../../fixtures/chatwoot/contact_created.json')).default;

    await dispatch(client as unknown as import('pg').PoolClient, {
      id: 1,
      event_type: 'contact_created',
      payload: contactCreated,
      environment,
      chatwoot_timestamp: lastEventAt,
    });

    const calls = client.query.mock.calls;
    const upsertCall = calls.find((c) =>
      (c[0] as string).includes('INSERT INTO core.contacts'),
    );
    expect(upsertCall).toBeDefined();
  });

  it('dispatches conversation_created to conversations repository', async () => {
    const { dispatch } = await loadDispatcher();
    const client = createMockClient();
    const conversationCreated = (await import('../../fixtures/chatwoot/conversation_created.json')).default;

    await dispatch(client as unknown as import('pg').PoolClient, {
      id: 2,
      event_type: 'conversation_created',
      payload: conversationCreated,
      environment,
      chatwoot_timestamp: lastEventAt,
    });

    const calls = client.query.mock.calls;
    const upsertCall = calls.find((c) =>
      (c[0] as string).includes('INSERT INTO core.conversations'),
    );
    expect(upsertCall).toBeDefined();
  });

  it('dispatches conversation_updated with tags', async () => {
    const { dispatch } = await loadDispatcher();
    const client = createMockClient();
    const conversationUpdated = (await import('../../fixtures/chatwoot/conversation_updated.json')).default;

    await dispatch(client as unknown as import('pg').PoolClient, {
      id: 3,
      event_type: 'conversation_updated',
      payload: conversationUpdated,
      environment,
      chatwoot_timestamp: lastEventAt,
    });

    const calls = client.query.mock.calls;
    const convUpsert = calls.find((c) =>
      (c[0] as string).includes('INSERT INTO core.conversations'),
    );
    const tagInsert = calls.find((c) =>
      (c[0] as string).includes('INSERT INTO core.conversation_tags'),
    );

    expect(convUpsert).toBeDefined();
    expect(tagInsert).toBeDefined();
  });

  it('dispatches conversation_updated with changed_attributes to status and assignment', async () => {
    const { dispatch } = await loadDispatcher();
    const client = createMockClient();

    await dispatch(client as unknown as import('pg').PoolClient, {
      id: 3,
      event_type: 'conversation_updated',
      payload: {
        id: 101,
        status: 'resolved',
        assignee_id: 42,
        team_id: 3,
        changed_attributes: [
          { attribute: 'status', previous_value: 'open', current_value: 'resolved' },
          { attribute: 'assignee_id', previous_value: null, current_value: 42 },
        ],
        labels: ['suporte'],
      },
      environment,
      chatwoot_timestamp: lastEventAt,
    });

    const calls = client.query.mock.calls;
    const statusInsert = calls.find((c) =>
      (c[0] as string).includes('INSERT INTO core.conversation_status_events'),
    );
    const assignmentInsert = calls.find((c) =>
      (c[0] as string).includes('INSERT INTO core.conversation_assignments'),
    );

    expect(statusInsert).toBeDefined();
    expect(assignmentInsert).toBeDefined();
  });

  it('dispatches conversation_status_changed with status event', async () => {
    const { dispatch } = await loadDispatcher();
    const client = createMockClient();
    const conversationStatusChanged = (await import('../../fixtures/chatwoot/conversation_status_changed.json')).default;

    await dispatch(client as unknown as import('pg').PoolClient, {
      id: 4,
      event_type: 'conversation_status_changed',
      payload: conversationStatusChanged,
      environment,
      chatwoot_timestamp: lastEventAt,
    });

    const calls = client.query.mock.calls;
    const statusInsert = calls.find((c) =>
      (c[0] as string).includes('INSERT INTO core.conversation_status_events'),
    );
    expect(statusInsert).toBeDefined();
  });

  it('dispatches message_created to messages repository', async () => {
    const { dispatch } = await loadDispatcher();
    const client = createMockClient();
    const messageCreated = (await import('../../fixtures/chatwoot/message_created.json')).default;

    await dispatch(client as unknown as import('pg').PoolClient, {
      id: 5,
      event_type: 'message_created',
      payload: messageCreated,
      environment,
      chatwoot_timestamp: lastEventAt,
    });

    const calls = client.query.mock.calls;
    const msgUpsert = calls.find((c) =>
      (c[0] as string).includes('INSERT INTO core.messages'),
    );
    expect(msgUpsert).toBeDefined();
  });

  it('dispatches message_created with attachments', async () => {
    const { dispatch } = await loadDispatcher();
    const client = createMockClient();
    const messageWithAttachment = (await import('../../fixtures/chatwoot/message_with_attachment.json')).default;

    await dispatch(client as unknown as import('pg').PoolClient, {
      id: 6,
      event_type: 'message_created',
      payload: messageWithAttachment,
      environment,
      chatwoot_timestamp: lastEventAt,
    });

    const calls = client.query.mock.calls;
    const attUpsert = calls.find((c) =>
      (c[0] as string).includes('INSERT INTO core.message_attachments'),
    );
    expect(attUpsert).toBeDefined();
  });

  it('throws SkipEventError for unknown event types', async () => {
    const { dispatch, SkipEventError } = await loadDispatcher();
    const client = createMockClient();

    await expect(
      dispatch(client as unknown as import('pg').PoolClient, {
        id: 7,
        event_type: 'unknown_event',
        payload: {},
        environment,
        chatwoot_timestamp: lastEventAt,
      }),
    ).rejects.toBeInstanceOf(SkipEventError);
  });
});
