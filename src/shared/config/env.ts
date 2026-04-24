import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FAREJADOR_ENV: z.enum(['prod', 'test']),
  PORT: z.string().transform(Number).pipe(z.number().int().min(1).max(65535)).default('3000'),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.string().transform(Number).pipe(z.number().int().min(1)).default('10'),
  CHATWOOT_HMAC_SECRET: z.string().min(1),
  CHATWOOT_WEBHOOK_MAX_AGE_SECONDS: z.string().transform(Number).pipe(z.number().int().min(1)).default('300'),
  CHATWOOT_API_BASE_URL: z.string().min(1).optional(),
  CHATWOOT_API_TOKEN: z.string().min(1).optional(),
  CHATWOOT_ACCOUNT_ID: z.string().transform(Number).pipe(z.number().int()).optional(),
  ADMIN_AUTH_TOKEN: z.string().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  console.error('Invalid environment variables:\n' + issues);
  process.exit(1);
}

export const env = parsed.data;
