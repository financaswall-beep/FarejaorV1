# CONFIG — Variáveis de ambiente

Inventário completo das variáveis de ambiente usadas pelo Farejador (Fase 1).
Todo código que lê env var deve ler via `src/shared/config/env.ts` (Zod-validated),
nunca `process.env.X` direto.

## Variáveis

| Nome | Obrigatória | Propósito | Exemplo |
|------|:-:|-----------|---------|
| `NODE_ENV` | sim | `development` \| `production` \| `test`. Controla logging e stack traces. | `production` |
| `FAREJADOR_ENV` | sim | Ambiente lógico de dados. Vai em toda linha gravada. `prod` \| `test`. | `prod` |
| `PORT` | não | Porta HTTP do Fastify. Default `3000`. | `3000` |
| `DATABASE_URL` | sim | Connection string do Supabase Postgres (via pooler em prod). | `postgresql://postgres:...@...supabase.co:6543/postgres` |
| `DATABASE_POOL_MAX` | não | Tamanho máximo do pool `pg`. Default `10`. | `10` |
| `CHATWOOT_HMAC_SECRET` | sim | Segredo para validar `X-Chatwoot-Signature`. | `<secret>` |
| `CHATWOOT_WEBHOOK_MAX_AGE_SECONDS` | não | Rejeita webhooks com `X-Chatwoot-Timestamp` mais antigo que isso. Default `300`. | `300` |
| `CHATWOOT_API_BASE_URL` | sim (admin) | URL base da API do Chatwoot para reconcile. | `https://chatwoot.example.com/api/v1` |
| `CHATWOOT_API_TOKEN` | sim (admin) | Token de acesso para reconcile. | `<token>` |
| `CHATWOOT_ACCOUNT_ID` | sim (admin) | Conta Chatwoot para reconcile. | `1` |
| `ADMIN_AUTH_TOKEN` | sim | Bearer simples para proteger `/admin/*`. | `<long-random>` |
| `LOG_LEVEL` | não | `trace`/`debug`/`info`/`warn`/`error`. Default `info` em prod, `debug` em dev. | `info` |

## Regras

1. **Nunca** commite `.env`. Apenas `.env.example` (sem valores reais).
2. **Nunca** logue valor de env var sensível (`CHATWOOT_HMAC_SECRET`, `ADMIN_AUTH_TOKEN`, `DATABASE_URL`).
3. Em Coolify, usar o gerenciador de secrets. Em dev local, arquivo `.env` no root.
4. Adicionar env var nova = task explícita que atualiza `CONFIG.md` + `.env.example` + `src/shared/config/env.ts` no mesmo commit.

## Pontos de validação

No boot da aplicação (`src/app/server.ts`), chamar o parser Zod de
`src/shared/config/env.ts`. Se faltar variável obrigatória, **falhar o boot** com
mensagem clara. Nunca usar default silencioso para segredo.
