# Farejador - Visao do Projeto

Sistema de captura deterministica de conversas do Chatwoot para Supabase Postgres.
O objetivo e construir a base de dados estruturada que vai alimentar analytics de
negocio e, no futuro, agentes LLM. O Farejador em si nao e o agente.

## Fases

| Fase | Nome | Resumo |
| --- | --- | --- |
| 1 | Farejador deterministico | Webhook, dedup, raw, normalizacao em core e admin replay. Zero LLM. |
| 2a | Enrichment deterministico | Workers SQL/regex populando `analytics.*`. Zero LLM. |
| 2b | Enrichment com LLM | Workers LLM populando somente `analytics.*`. |
| 3 | Agente atendente | Servico separado, read-only sobre `core.*` e `analytics.*`. |

## Status atual

- F1-01 webhook ingestion: concluida e validada contra Supabase.
- F1-02 normalizacao deterministica: concluida, auditada e validada com 60 testes.
- F1-03 admin endpoints: proxima etapa.

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
