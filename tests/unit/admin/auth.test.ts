import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';

const baseEnv = {
  NODE_ENV: 'test',
  FAREJADOR_ENV: 'prod',
  DATABASE_URL: 'postgresql://postgres:password@example.test:6543/postgres',
  CHATWOOT_HMAC_SECRET: 'test-secret',
  ADMIN_AUTH_TOKEN: 'expected-admin-token',
};

function createRequest(authHeader?: string): FastifyRequest {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as FastifyRequest;
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

async function loadAuth(): Promise<(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
) => void> {
  vi.resetModules();
  Object.assign(process.env, baseEnv);
  const module = await import('../../../src/admin/auth.js');
  return module.requireAdminAuth;
}

describe('requireAdminAuth', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns 401 when header is missing', async () => {
    const requireAdminAuth = await loadAuth();
    const request = createRequest();
    const reply = createReply();
    const done = vi.fn() as unknown as HookHandlerDoneFunction;

    requireAdminAuth(request, reply, done);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: 'Unauthorized' });
    expect(done).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer ', async () => {
    const requireAdminAuth = await loadAuth();
    const request = createRequest('Basic abc');
    const reply = createReply();
    const done = vi.fn() as unknown as HookHandlerDoneFunction;

    requireAdminAuth(request, reply, done);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: 'Unauthorized' });
    expect(done).not.toHaveBeenCalled();
  });

  it('returns 401 when token has different length without throwing', async () => {
    const requireAdminAuth = await loadAuth();
    const request = createRequest('Bearer short');
    const reply = createReply();
    const done = vi.fn() as unknown as HookHandlerDoneFunction;

    expect(() => requireAdminAuth(request, reply, done)).not.toThrow();
    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: 'Unauthorized' });
    expect(done).not.toHaveBeenCalled();
  });

  it('returns 401 when token has same length but wrong content', async () => {
    const requireAdminAuth = await loadAuth();
    const request = createRequest('Bearer expected-admin-XXXX');
    const reply = createReply();
    const done = vi.fn() as unknown as HookHandlerDoneFunction;

    requireAdminAuth(request, reply, done);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: 'Unauthorized' });
    expect(done).not.toHaveBeenCalled();
  });

  it('calls done when token is correct', async () => {
    const requireAdminAuth = await loadAuth();
    const request = createRequest('Bearer expected-admin-token');
    const reply = createReply();
    const done = vi.fn() as unknown as HookHandlerDoneFunction;

    requireAdminAuth(request, reply, done);

    expect(reply.statusCode).toBe(200);
    expect(done).toHaveBeenCalledOnce();
  });
});
