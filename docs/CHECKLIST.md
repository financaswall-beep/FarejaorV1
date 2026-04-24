# Checklist Master — Farejador
**Atualizado**: 23/04/2026

Legenda: ✅ Feito | ⚠️ Feito com ressalva | 🔜 Próximo | ⏳ Aguardando | 🔒 Futuro

---

## 1. Infraestrutura e decisões

- [x] Stack definida (TypeScript + Node 20 + Fastify + Zod + pg + Pino + Vitest)
- [x] Arquitetura em 3 fases decidida (1 determinístico / 2a+2b enrichment / 3 atendente)
- [x] Invariantes documentadas (LLM nunca toca raw/core, watermark, dedup, environment)
- [x] Repositório criado em `C:\Farejador agente\`
- [x] Node.js v24 instalado na máquina
- [x] PowerShell — política de execução liberada (`RemoteSigned`)
- [x] `npm install` limpo (93 pacotes, sem erros)
- [ ] Git inicializado no repositório (`git init`)
- [ ] `.env` criado a partir de `.env.example` com valores reais
- [ ] Migrations aplicadas no Supabase (`aoqtgwzeyznycuakrdhp`)

---

## 2. Schema do banco — migrations

- [x] `0001_init_schemas.sql` — extensions, schemas, domínio `env_t`
- [x] `0002_raw_layer.sql` — `raw.raw_events` particionada + índices
- [x] `0003_core_layer.sql` — contacts, conversations, messages, attachments, tags, status_events, assignments, reactions
- [x] `0004_analytics_layer.sql` — facts, signals, classifications, customer_journey, linguistic_hints
- [x] `0005_ops_layer.sql` — stock_snapshots, enrichment_jobs, bot_events, erasure_log, anonymize_contact()
- [x] `0006_concurrency_guards.sql` — delivery_seen, last_event_at, skip_stale_update trigger, ensure_monthly_partitions()
- [x] `db/migrations/README.md` — convenções, fases, regras de concorrência
- [ ] Migrations aplicadas no Supabase (pendente decisão MCP vs manual)

---

## 3. Documentação de controle

- [x] `AGENTS.md` — guia operacional para agentes de IA
- [x] `docs/PROJECT.md` — visão geral
- [x] `docs/KIMI_RULES.md` — regras obrigatórias do executor
- [x] `docs/CONTRACTS.md` — regras dos tipos compartilhados
- [x] `docs/CONFIG.md` — inventário de env vars
- [x] `docs/LOGGING.md` — padrão pino JSON
- [x] `docs/REVIEW_PROTOCOL.md` — fluxo de review
- [x] `docs/HANDOFF.md` — relatório de contexto para nova sessão
- [x] `docs/CHECKLIST.md` — este arquivo
- [x] `docs/adr/ADR-001-core-vs-analytics.md`
- [x] `docs/adr/ADR-002-deterministic-mvp.md`
- [x] `docs/adr/ADR-003-no-premature-files.md`
- [x] `docs/phases/PHASE_01.md`

---

## 4. Tasks da Fase 1

- [x] `docs/tasks/F1-01-webhook.md` — escrito e revisado
- [x] `docs/tasks/F1-02-normalization.md` — escrito, alertas de auditoria adicionados
- [x] `docs/tasks/F1-03-admin.md` — escrito e revisado
- [x] `docs/tasks/F1-04-tests.md` — escrito, escopo corrigido após ambiguidade

---

## 5. Stubs pré-existentes (antes do Kimi)

- [x] `src/shared/types/chatwoot.ts` — schemas Zod completos
- [x] `package.json` — dependências corretas (sem `@fastify/raw-body` inexistente)
- [x] `tsconfig.json` — strict mode, NodeNext, ES2022
- [x] `.env.example` — todas as env vars com placeholders
- [x] `.gitignore` — node_modules, .env*, dist

---

## 6. Execução das tasks — Kimi K2

### F1-04 — Fixtures + infraestrutura de testes ✅ APROVADA
- [x] `vitest.config.ts`
- [x] `tests/fixtures/chatwoot/contact_created.json`
- [x] `tests/fixtures/chatwoot/contact_updated.json`
- [x] `tests/fixtures/chatwoot/conversation_created.json`
- [x] `tests/fixtures/chatwoot/conversation_updated.json`
- [x] `tests/fixtures/chatwoot/conversation_status_changed.json`
- [x] `tests/fixtures/chatwoot/message_created.json`
- [x] `tests/fixtures/chatwoot/message_updated.json`
- [x] `tests/helpers/hmac.ts`
- [x] `tests/helpers/db.ts` (esqueleto)
- [x] `tests/unit/shared/types/chatwoot.test.ts` — 8 testes (7 positivos + 1 negativo)
- [x] `tests/README.md`
- [x] `npm test` verde na máquina do dono (8/8)
- [ ] `tests/fixtures/chatwoot/message_with_attachment.json` — adiado para F1-02
- [ ] `import 'node:crypto'` em vez de `'crypto'` no hmac.ts — correção menor, feita em F1-01

---

### F1-01 — Webhook end-to-end 🔜 PRÓXIMA
- [ ] `src/app/server.ts`
- [ ] `src/app/routes.ts`
- [ ] `src/webhooks/chatwoot.route.ts`
- [ ] `src/webhooks/chatwoot.handler.ts`
- [ ] `src/webhooks/chatwoot.hmac.ts`
- [ ] `src/persistence/db.ts`
- [ ] `src/persistence/raw-events.repository.ts`
- [ ] `src/persistence/delivery-seen.repository.ts`
- [ ] `src/shared/config/env.ts`
- [ ] `src/shared/logger.ts`
- [ ] `src/webhooks/chatwoot.handler.test.ts`
- [ ] Rota `POST /webhooks/chatwoot` funcional
- [ ] HMAC validado (timing-safe)
- [ ] Timestamp expirado rejeitado
- [ ] Dedup via `raw.delivery_seen`
- [ ] Insert em `raw.raw_events`
- [ ] Resposta 2xx rápida
- [ ] Shutdown gracioso (SIGTERM)
- [ ] `npm test` verde com testes do handler

---

### F1-02 — Worker de normalização ⏳ AGUARDANDO F1-01
- [ ] `src/normalization/worker.ts`
- [ ] `src/normalization/dispatcher.ts`
- [ ] `src/normalization/contact.mapper.ts`
- [ ] `src/normalization/conversation.mapper.ts`
- [ ] `src/normalization/message.mapper.ts`
- [ ] `src/normalization/attachment.mapper.ts`
- [ ] `src/normalization/status-event.mapper.ts`
- [ ] `src/normalization/assignment.mapper.ts`
- [ ] `src/normalization/reaction.mapper.ts`
- [ ] `src/normalization/tag.mapper.ts`
- [ ] `src/persistence/contacts.repository.ts`
- [ ] `src/persistence/conversations.repository.ts`
- [ ] `src/persistence/messages.repository.ts`
- [ ] `src/persistence/attachments.repository.ts`
- [ ] `src/persistence/status-events.repository.ts`
- [ ] `src/persistence/assignments.repository.ts`
- [ ] `src/persistence/reactions.repository.ts`
- [ ] `src/persistence/tags.repository.ts`
- [ ] `tests/fixtures/chatwoot/message_with_attachment.json`
- [ ] `sender_type` normalizado para lowercase no mapper
- [ ] `sender: {}` tratado com optional chaining
- [ ] Upserts com watermark `last_event_at`
- [ ] Worker com `FOR UPDATE SKIP LOCKED`
- [ ] `npm test` verde com testes de normalização

---

### F1-03 — Admin endpoints ⏳ AGUARDANDO F1-02
- [ ] `src/admin/auth.ts`
- [ ] `src/admin/health.route.ts`
- [ ] `src/admin/replay.route.ts`
- [ ] `src/admin/replay.service.ts`
- [ ] `src/admin/reconcile.route.ts`
- [ ] `src/admin/reconcile.service.ts`
- [ ] `src/admin/chatwoot-api.client.ts`
- [ ] `GET /healthz` funcional
- [ ] `POST /admin/replay/:id` funcional
- [ ] `POST /admin/reconcile` funcional
- [ ] Auth bearer com timing-safe compare
- [ ] `npm test` verde

---

## 7. Critérios de aceite da Fase 1 (deploy)

- [ ] Webhook recebe evento real → linha em `raw.raw_events` em < 500ms
- [ ] Mesmo evento duplicado → zero segunda linha
- [ ] HMAC inválido → 401, zero escrita
- [ ] Timestamp > 5 min → 401, zero escrita
- [ ] Worker normaliza → `core.*` populado com watermark
- [ ] Evento fora de ordem → trigger `skip_stale_update` barra
- [ ] `/admin/replay/:id` reprocessa linha `failed`
- [ ] `/admin/reconcile` traz conversas faltantes sem duplicar
- [ ] Suite de testes verde (Vitest)
- [ ] Deploy em staging recebendo webhooks reais por 7 dias sem perdas

---

## 8. Fase 2a — Enrichment determinístico 🔒 FUTURO
- [ ] Workers SQL/regex para `analytics.conversation_signals`
- [ ] Workers regex para `analytics.linguistic_hints`
- [ ] `analytics.customer_journey` básico
- [ ] `analytics.conversation_classifications` via regras manuais

## 9. Fase 2b — Enrichment com LLM 🔒 FUTURO
- [ ] Worker LLM para `analytics.conversation_facts`
- [ ] Worker LLM para `analytics.conversation_classifications`
- [ ] Transcrição de áudio (Whisper)
- [ ] Prompts versionados em repo
- [ ] `ops.enrichment_jobs` com workers reais

## 10. Fase 3 — Agente atendente 🔒 FUTURO (serviço separado)
- [ ] Novo container / repo
- [ ] Lê `core.*` + `analytics.*` como cliente read-only
- [ ] Nunca escreve no banco do Farejador

## 11. Roadmap distante (fora do plano ativo)
- [ ] Treino de LLM próprio com dataset capturado
- [ ] Dashboard web
- [ ] Multi-tenant
- [ ] pgvector + embeddings
