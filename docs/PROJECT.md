# Farejador - Visao do Projeto

Sistema de captura deterministica de conversas do Chatwoot para Supabase Postgres.
O objetivo e construir a base de dados estruturada que vai alimentar analytics de
negocio e, no futuro, agentes LLM. O Farejador em si nao e o agente.

## Fases

| Fase | Nome | Resumo |
| --- | --- | --- |
| 1 | Farejador deterministico | Webhook, dedup, raw, normalizacao em core, admin replay e reconcile. Zero LLM. |
| 2a | Enrichment deterministico | Workers SQL/regex populando `analytics.*`. Zero LLM. |
| 2b | Enrichment com LLM | Workers LLM populando somente `analytics.*`. |
| 3 | Agente atendente | Servico separado, read-only sobre `core.*` e `analytics.*`. |

## Status atual

- F1-01 webhook ingestion: concluida e validada contra Supabase.
- F1-02 normalizacao deterministica: concluida, auditada, corrigida e validada em teste local e Supabase real.
- F1-03 admin endpoints: concluida, auditada, corrigida e validada com Chatwoot/Supabase reais.
- F1.5 hardening pre-producao plena: aplicado e publicado.
- Fase 1 tecnica: concluida. Estado atual: shadow mode controlado antes de producao plena.

Validacao atual:

- `npm test`: 112/112.
- `npm run typecheck`: verde.
- `npm run build`: verde.
- Webhook real, replay real, reconcile real e dois workers concorrentes ja foram validados.

## Invariantes

- `environment` obrigatorio em toda tabela relevante.
- Producao e teste nunca se misturam.
- Dedup por `X-Chatwoot-Delivery` antes de gravar raw.
- `raw.raw_events` preserva payload bruto para auditoria e replay.
- Normalizacao estrutural escreve em `core.*`.
- Dados interpretados escrevem somente em `analytics.*`.
- LLM nunca escreve em `raw.*` ou `core.*`.
- Fase 1 nao chama LLM.
- Fase 1 nao popula `ops.enrichment_jobs`.

## Decisoes recentes da F1-02

- `upsertMessage()` devolve o UUID da mensagem e o UUID da conversa.
- Attachments usam o UUID de conversa ja resolvido, sem subselect fragil.
- `reaction.mapper` continua placeholder, mas payload de reaction gera `logger.warn`.
- `SAVEPOINT normalize_event` no worker e intencional para marcar falha sem soltar lock.

## Decisoes recentes da F1-03

- `/healthz` nao exige auth e valida DB com timeout.
- `/admin/replay/:raw_event_id` exige bearer e altera somente campos operacionais.
- `/admin/reconcile` exige bearer, limita janela a 7 dias e injeta somente raw_events sinteticos.
- Reconcile usa delivery_id deterministico `reconcile-v2:tipo:env:account_id:id:ts` para idempotencia via `raw.delivery_seen` sem colisao entre contas.
- Reconcile retorna resultado parcial com `aborted` e `abort_reason` quando a paginacao de conversas falha.

## Decisoes recentes da F1.5

- `raw.raw_events` agora tem trigger de imutabilidade no banco: apenas `processing_status`, `processing_error` e `processed_at` podem mudar.
- `core.conversation_status_events` e `core.conversation_assignments` tem UNIQUE constraints para idempotencia atomica.
- Repositories auxiliares usam `ON CONFLICT ON CONSTRAINT ... DO NOTHING`, entao conflito concorrente vira no-op e nao `failed`.
- `core.contacts.first_seen_at` nao e sobrescrito em updates.
- SSL aceita `DATABASE_CA_CERT` para validacao de certificado; sem CA em prod gera aviso e deve ser corrigido antes de producao plena.
- `ops.orphan_conversation_stubs` e `ops.report_orphan_stubs()` monitoram stubs de conversa.

## Ressalvas antes de producao plena

- Manter shadow mode por periodo combinado e monitorar `pending`, `failed`, `skipped`, stubs orfaos e latencia da fila.
- Rotacionar secrets manipulados durante configuracao: token Chatwoot, segredo HMAC, token admin e credenciais do banco se necessario.
- Configurar `DATABASE_CA_CERT` no Coolify.
- Adicionar harness de integracao automatizado com Postgres real antes de aumentar o escopo da Fase 2a.
- Migrar mappers criticos para Zod permissivo e limpar o caminho legado de body dos testes.

## Stack

- TypeScript + Node.js
- Fastify
- Zod
- Supabase Postgres via `pg`
- Pino
- Vitest

## Referencias

- `AGENTS.md`
- `db/migrations/README.md`
- `docs/DATA_DICTIONARY.md`
- `docs/KIMI_RULES.md`
- `docs/phases/PHASE_01.md`
- `docs/tasks/F1-03-admin.md`
- `docs/adr/`
