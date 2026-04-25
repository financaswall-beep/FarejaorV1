# Checklist Master - Farejador

Atualizado: 25/04/2026

Legenda: feito, em andamento, proximo, futuro.

## 1. Infraestrutura

- [x] Stack definida: TypeScript, Node.js, Fastify, Zod, pg, Pino, Vitest.
- [x] Arquitetura em fases documentada.
- [x] Invariantes documentadas: raw imutavel, dedup, environment, watermark, LLM fora de raw/core.
- [x] Repositorio local em `C:\Farejador agente`.
- [x] Dependencias instaladas.
- [x] `.env.codex` configurado para validacao local.
- [x] Conexao Supabase validada.
- [x] Migrations aplicadas no Supabase usado na validacao.
- [x] GitHub remoto atualizado ate F1-03.
- [x] Deploy Coolify do Farejador validado.
- [x] Supabase Connection Pooler validado no Coolify.
- [x] Chatwoot real conectado ao Farejador em shadow mode.

## 2. Schema do banco

- [x] `0001_init_schemas.sql`
- [x] `0002_raw_layer.sql`
- [x] `0003_core_layer.sql`
- [x] `0004_analytics_layer.sql`
- [x] `0005_ops_layer.sql`
- [x] `0006_concurrency_guards.sql`
- [x] `db/migrations/README.md`

## 3. Documentacao de controle

- [x] `AGENTS.md`
- [x] `docs/PROJECT.md`
- [x] `docs/KIMI_RULES.md`
- [x] `docs/CONTRACTS.md`
- [x] `docs/CONFIG.md`
- [x] `docs/LOGGING.md`
- [x] `docs/REVIEW_PROTOCOL.md`
- [x] `docs/HANDOFF.md`
- [x] `docs/CHECKLIST.md`
- [x] `docs/DATA_DICTIONARY.md`
- [x] `docs/BASE_FORK_POINT.md`
- [x] `docs/TIRE_SALES_SYNTHETIC_SCENARIOS.md`
- [x] `docs/phases/PHASE_01.md`
- [x] `docs/tasks/F1-01-webhook.md`
- [x] `docs/tasks/F1-02-normalization.md`
- [x] `docs/tasks/F1-03-admin.md`
- [x] `docs/tasks/F1-04-tests.md`

## 4. Fase 1

### F1-04 - Fixtures e testes base

- [x] Fixtures Chatwoot sinteticas.
- [x] Fixtures sinteticas de cenarios de venda de pneus.
- [x] Helpers de HMAC.
- [x] Testes de contratos.
- [x] Fixtures sanitizadas.

### F1-01 - Webhook end-to-end

- [x] `POST /webhooks/chatwoot`.
- [x] HMAC timing-safe.
- [x] HMAC oficial do Chatwoot validado com `timestamp.raw_body`.
- [x] Timestamp expirado rejeitado.
- [x] Dedup via `raw.delivery_seen`.
- [x] Insert em `raw.raw_events`.
- [x] Resposta 2xx rapida.
- [x] Shutdown gracioso.
- [x] Validacao end-to-end contra Supabase.

### F1-02 - Normalizacao deterministica

- [x] Worker com `FOR UPDATE SKIP LOCKED`.
- [x] Uma transacao por raw_event.
- [x] `SAVEPOINT normalize_event` preservado para marcar `failed` sem soltar lock.
- [x] Dispatcher por event_type.
- [x] Mappers de contact, conversation, message, attachment, status event, assignment, reaction e tag.
- [x] Repositories para `core.*`.
- [x] Upserts com watermark em contacts/conversations/messages.
- [x] Idempotencia em tags, status events, assignments, attachments e reactions.
- [x] Stub de conversa para mensagem fora de ordem.
- [x] Attachments usam UUID de conversa retornado por `upsertMessage`.
- [x] Reaction placeholder gera `logger.warn`.
- [x] Sem analytics, sem ops.enrichment_jobs, sem LLM e sem chamada externa.
- [x] `npm test` 60/60.
- [x] `npm run typecheck` verde.
- [x] `npm run build` verde.

### F1-03 - Admin endpoints

- [x] `GET /healthz`.
- [x] Auth bearer timing-safe para `/admin/*`.
- [x] `POST /admin/replay/:raw_event_id`.
- [x] Replay com `FOR UPDATE` e reset apenas de campos operacionais.
- [x] `POST /admin/reconcile`.
- [x] Cliente API Chatwoot com timeout, retry e paginacao.
- [x] Reconcile injeta raw_events sinteticos com delivery_id deterministico.
- [x] Reconcile retorna resultado parcial quando a paginacao falha.
- [x] Testes unitarios de auth, health, replay, cliente Chatwoot, reconcile service e route.
- [x] `npm test` 108/108.
- [x] `npm run typecheck` verde.
- [x] `npm run build` verde.
- [x] Teste manual com Chatwoot real e Supabase real para webhook, contato, conversa e mensagem.

## 5. Criterios restantes para fechar Fase 1

- [x] `/admin/replay/:id` reprocessa uma linha `failed` no contrato unitario.
- [x] `/admin/reconcile` traz conversas faltantes sem duplicar no contrato unitario.
- [x] Farejador publicado no Coolify e conectado ao Supabase.
- [x] Webhook real Chatwoot -> Farejador confirmado em `raw.raw_events`.
- [x] Definir protecao contra ruido de `message_updated` antes de religar webhook da inbox API. Implementado via `SKIP_EVENT_TYPES` (CSV) com filtro no dispatcher; raw permanece gravado e o evento e marcado como `skipped`.
- [x] Webhook da inbox API religado com `SKIP_EVENT_TYPES=message_updated`.
- [x] Payload real aninhado do Chatwoot tratado nos mappers/dispatcher.
- [x] Teste final validou `core.contacts`, `core.conversations` e `core.messages` vinculados.
- [x] Cenarios sinteticos de venda de pneus processados no Supabase real com `environment=test`: 49/49 `processed`, 0 `failed`.
- [x] Idempotencia dos cenarios sinteticos validada: segunda execucao com 49/49 duplicatas ignoradas.
- [ ] Replay real nao duplica status events, assignments, messages ou attachments.
- [ ] Reconcile real em janela pequena injeta `raw_events` sem duplicar.
- [ ] Dois workers nao pegam o mesmo raw_event em teste/integracao com Postgres.
- [ ] Shadow mode com webhooks reais por periodo combinado.
- [ ] Rotacionar secrets antes de producao plena.

## 6. Futuro

- [ ] Fase 2a: enrichment deterministico em `analytics.*`.
- [ ] Fase 2b: enrichment com LLM escrevendo somente em `analytics.*`.
- [ ] Fase 3: agente conversacional separado, read-only sobre Farejador.
