# Fase 1 — Farejador determinístico (MVP)

## Objetivo

Receber webhooks do Chatwoot, validar autenticidade, deduplicar, persistir payload
bruto e normalizar para as tabelas operacionais (`core.*`). Tudo determinístico,
zero LLM.

## Entregáveis

- Endpoint HTTP `POST /webhooks/chatwoot` com:
  - validação HMAC via `X-Chatwoot-Signature`
  - rejeição de timestamps muito antigos
  - deduplicação via `raw.delivery_seen`
  - persistência em `raw.raw_events` (partitioned)
  - resposta 2xx rápida, normalização async
- Worker de normalização que lê `raw.raw_events` em `pending` e popula:
  - `core.contacts`
  - `core.conversations`
  - `core.messages` (partitioned)
  - `core.message_attachments`
  - `core.conversation_tags`
  - `core.conversation_status_events`
  - `core.conversation_assignments`
  - `core.message_reactions`
- Endpoints admin com auth bearer simples:
  - `GET /healthz`
  - `POST /admin/replay/:raw_event_id`
  - `POST /admin/reconcile` (backfill via API Chatwoot)
- Suite de testes com fixtures reais do Chatwoot

## Fora de escopo

- Qualquer escrita em `analytics.*`
- Qualquer chamada de LLM (classificação, transcrição, extração)
- Dashboard ou UI
- Transcrição de áudio
- `ops.stock_snapshots`, `ops.bot_events` (tabelas permanecem vazias)
- Multi-tenant
- Observability avançada (métricas Prometheus, tracing) — só logs estruturados

## Tasks

| ID | Título | Arquivo |
|----|--------|---------|
| F1-01 | Webhook end-to-end | `docs/tasks/F1-01-webhook.md` |
| F1-02 | Worker de normalização | `docs/tasks/F1-02-normalization.md` |
| F1-03 | Endpoints admin | `docs/tasks/F1-03-admin.md` |
| F1-04 | Fixtures + testes mínimos | `docs/tasks/F1-04-tests.md` |

**Ordem recomendada**: F1-04 (fixtures) → F1-01 (webhook) → F1-02 (normalização) → F1-03 (admin).

Fixtures primeiro porque as tasks 01 e 02 se beneficiam de testes desde o começo.

## Pré-requisitos (antes de F1-01 começar)

- [x] Migrations `0001`–`0006` aplicadas no Supabase
- [x] `src/shared/types/chatwoot.ts` criado e revisado (stub em `docs/` já gerado)
- [x] `package.json`, `tsconfig.json`, `.env.example`, `.gitignore` no repo
- [x] `docs/KIMI_RULES.md` anexado em todo prompt de task

## Critérios de aceite da Fase 1

A Fase 1 está pronta quando:

1. Um evento Chatwoot real chega no webhook → linha aparece em `raw.raw_events` em < 500ms
2. O mesmo evento duplicado (mesmo `X-Chatwoot-Delivery`) **não** gera segunda linha
3. Assinatura HMAC inválida → resposta 401, zero escrita
4. Timestamp > 5 min → resposta 401, zero escrita
5. Worker pega pending → popula `core.*` com watermark correto
6. Evento fora de ordem → linha mais antiga é ignorada (trigger `skip_stale_update`)
7. `/admin/replay/:id` reprocessa uma linha `failed` → vira `processed`
8. `/admin/reconcile` com janela de datas → traz conversas faltantes via API
9. Suite de testes passa (Vitest) com fixtures reais de cada event_type
10. Tempo médio de resposta do webhook < 200ms em staging

## O que marca fim da Fase 1

Deploy em staging recebendo webhooks reais do Chatwoot de produção (shadow mode)
por **pelo menos 7 dias** sem perdas detectadas na reconciliação.
