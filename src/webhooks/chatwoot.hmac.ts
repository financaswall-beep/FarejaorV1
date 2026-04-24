import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../shared/config/env.js';

const allowedFutureSkewMs = 60_000;

export function parseChatwootTimestamp(timestamp: string): Date | null {
  // Chatwoot sends X-Chatwoot-Timestamp as Unix seconds, not milliseconds.
  const timestampMs = Number(timestamp) * 1000;

  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return null;
  }

  return new Date(timestampMs);
}

export function validateTimestamp(timestamp: string): boolean {
  const parsed = parseChatwootTimestamp(timestamp);
  if (!parsed) {
    return false;
  }

  const ageMs = Date.now() - parsed.getTime();
  const maxAgeMs = env.CHATWOOT_WEBHOOK_MAX_AGE_SECONDS * 1000;

  return ageMs <= maxAgeMs && ageMs >= -allowedFutureSkewMs;
}

export function validateHmac(rawBody: Buffer, signature: string): boolean {
  const expected = createHmac('sha256', env.CHATWOOT_HMAC_SECRET).update(rawBody).digest('hex');
  const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;

  if (!/^[a-f0-9]{64}$/i.test(provided)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}
