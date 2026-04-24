import pino from 'pino';
import { env } from './config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-chatwoot-signature"]',
      '*.phone_number',
      '*.phone_e164',
      '*.email',
      '*.hmac_secret',
    ],
    censor: '[REDACTED]',
  },
});
