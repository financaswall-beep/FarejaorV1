import pino from 'pino';
import type { LoggerOptions } from 'pino';
import { env } from './config/env.js';

export const loggerOptions: LoggerOptions = {
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
};

export const logger = pino(loggerOptions);
