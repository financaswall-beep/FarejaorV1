import crypto from 'crypto';
import { env } from '../shared/config/env.js';

export function validateTimestamp(timestampStr: string): boolean {
  const timestampMs = Number(timestampStr) * 1000;
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return false;
  }
  const now = Date.now();
  const maxAgeMs = env.CHATWOOT_WEBHOOK_MAX_AGE_SECONDS * 1000;
  return now - timestampMs <= maxAgeMs;
}

export function validateHmac(rawBody: Buffer, signature: string): boolean {
  const secret = env.CHATWOOT_HMAC_SECRET;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;

  if (expected.length !== provided.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}
