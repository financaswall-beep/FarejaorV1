import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const baseEnv = {
  NODE_ENV: 'test',
  FAREJADOR_ENV: 'prod',
  DATABASE_URL: 'postgresql://postgres:password@example.test:6543/postgres',
  CHATWOOT_HMAC_SECRET: 'test-secret',
  CHATWOOT_WEBHOOK_MAX_AGE_SECONDS: '300',
  ADMIN_AUTH_TOKEN: 'test-admin-token',
};

async function loadHmacModule(): Promise<typeof import('../../../src/webhooks/chatwoot.hmac')> {
  vi.resetModules();
  Object.assign(process.env, baseEnv);
  return import('../../../src/webhooks/chatwoot.hmac');
}

describe('chatwoot hmac helpers', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('accepts a valid HMAC signature', async () => {
    const { validateHmac } = await loadHmacModule();
    const body = Buffer.from('{"event":"message_created"}');
    const signature = createHmac('sha256', baseEnv.CHATWOOT_HMAC_SECRET).update(body).digest('hex');

    expect(validateHmac(body, signature)).toBe(true);
    expect(validateHmac(body, `sha256=${signature}`)).toBe(true);
  });

  it('rejects invalid HMAC signatures', async () => {
    const { validateHmac } = await loadHmacModule();
    const body = Buffer.from('{"event":"message_created"}');

    expect(validateHmac(body, 'invalid')).toBe(false);
    expect(validateHmac(body, '0'.repeat(64))).toBe(false);
  });

  it('rejects expired timestamps', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:10:00Z'));

    const { validateTimestamp } = await loadHmacModule();

    expect(validateTimestamp(String(Date.parse('2026-04-23T12:00:00Z') / 1000))).toBe(false);
  });

  it('accepts recent timestamps', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:03:00Z'));

    const { validateTimestamp } = await loadHmacModule();

    expect(validateTimestamp(String(Date.parse('2026-04-23T12:00:30Z') / 1000))).toBe(true);
  });
});
