import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

const baseEnv = {
  NODE_ENV: 'test',
  FAREJADOR_ENV: 'prod',
  DATABASE_URL: 'postgresql://postgres:password@example.test:6543/postgres',
  CHATWOOT_HMAC_SECRET: 'test-secret',
  CHATWOOT_WEBHOOK_MAX_AGE_SECONDS: '300',
  ADMIN_AUTH_TOKEN: 'test-admin-token',
};

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function createReply(): FastifyReply {
  const reply = {
    statusCode: 200,
    payload: undefined as unknown,
    status: vi.fn(function status(this: typeof reply, code: number) {
      this.statusCode = code;
      return this;
    }),
    send: vi.fn(function send(this: typeof reply, payload: unknown) {
      this.payload = payload;
      return this;
    }),
  };

  return reply as unknown as FastifyReply;
}

function createRequest(payload: unknown, signatureOverride?: string): FastifyRequest {
  const raw = Buffer.from(JSON.stringify(payload));
  const signature =
    signatureOverride ?? createHmac('sha256', baseEnv.CHATWOOT_HMAC_SECRET).update(raw).digest('hex');

  return {
    body: { raw, parsed: payload },
    headers: {
      'x-chatwoot-signature': signature,
      'x-chatwoot-delivery': 'delivery-1',
      'x-chatwoot-timestamp': String(Math.floor(Date.now() / 1000)),
    },
  } as unknown as FastifyRequest;
}

async function loadHandler(client: MockClient): Promise<{
  handler: typeof import('../../../src/webhooks/chatwoot.handler').chatwootWebhookHandler;
  connect: ReturnType<typeof vi.fn>;
}> {
  vi.resetModules();
  Object.assign(process.env, baseEnv);

  const connect = vi.fn().mockResolvedValue(client);
  vi.doMock('pino', () => ({
    default: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  }));
  vi.doMock('pg', () => ({
    Pool: vi.fn(() => ({
      connect,
      on: vi.fn(),
      end: vi.fn(),
    })),
  }));

  const module = await import('../../../src/webhooks/chatwoot.handler');
  return { handler: module.chatwootWebhookHandler, connect };
}

describe('chatwootWebhookHandler', () => {
  afterEach(() => {
    vi.doUnmock('pg');
    vi.doUnmock('pino');
    vi.resetModules();
  });

  it('persists a valid webhook as pending raw event', async () => {
    const client: MockClient = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 123 }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const { handler } = await loadHandler(client);
    const reply = createReply();

    await handler(
      createRequest({ event: 'message_created', account: { id: 1 }, id: 1001 }),
      reply,
    );

    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toEqual({ received: true, delivery_id: 'delivery-1' });
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('returns 200 for duplicate deliveries without inserting raw event', async () => {
    const client: MockClient = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const { handler } = await loadHandler(client);
    const reply = createReply();

    await handler(
      createRequest({ event: 'message_created', account: { id: 1 }, id: 1001 }),
      reply,
    );

    expect(reply.statusCode).toBe(200);
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects invalid signatures before touching the database', async () => {
    const client: MockClient = { query: vi.fn(), release: vi.fn() };
    const { handler, connect } = await loadHandler(client);
    const reply = createReply();

    await handler(
      createRequest({ event: 'message_created', account: { id: 1 }, id: 1001 }, '0'.repeat(64)),
      reply,
    );

    expect(reply.statusCode).toBe(401);
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads before touching the database', async () => {
    const client: MockClient = { query: vi.fn(), release: vi.fn() };
    const { handler, connect } = await loadHandler(client);
    const reply = createReply();

    await handler(createRequest({ account: { id: 1 }, id: 1001 }), reply);

    expect(reply.statusCode).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });
});
