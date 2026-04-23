# Farejador — Visão do Projeto

Sistema de captura determinística de conversas do Chatwoot (WhatsApp, Instagram, Facebook)
para Supabase Postgres. Objetivo: construir a base de dados estruturada que vai alimentar
analytics de negócio e, no futuro, um agente conversacional LLM. O Farejador em si **não é**
o agente — é a fundação.

## Fases

| Fase | Nome | Resumo |
|------|------|--------|
| 1 | Farejador determinístico | Webhook → HMAC → dedup → raw → core. Zero LLM. |
| 2a | Enrichment determinístico | Workers com SQL/regex populando analytics. Zero LLM. |
| 2b | Enrichment com LLM | Workers LLM populando só `analytics.*`. |
| 3 | Agente atendente | Serviço separado, read-only sobre `core + analytics`. |
| 4 | (parked) | Treino de LLM próprio. Fora do plano ativo. |

## Invariantes inegociáveis

- `environment` obrigatório em toda tabela (`prod` / `test`).
- Dedup obrigatório por `X-Chatwoot-Delivery` antes de gravar em `raw.raw_events`.
- `raw.raw_events` é imutável após insert. Só se atualiza `processing_status`.
- Watermark `last_event_at` em `core.*` — evento antigo não sobrescreve novo.
- LLM **nunca** escreve em `raw.*` ou `core.*`. Só em `analytics.*`.
- Dados observados (`core.*`) e inferidos (`analytics.*`) não se misturam.
- Proveniência (`source`, `extractor_version`, `confidence_level`, `truth_type`) só em `analytics.*`.
- Schema técnico em inglês. Conteúdo das conversas preservado no idioma original (pt-BR).

## Stack

- TypeScript + Node.js 20
- Fastify (HTTP)
- Zod (validação)
- Supabase Postgres (direct `pg` driver, não o SDK)
- Pino (logging)
- Vitest (testes)

## Escopo do MVP (Fase 1)

Popula apenas: `raw.raw_events`, `core.*`, `ops.enrichment_jobs` (enfileira, sem worker),
`ops.erasure_log` (quando houver requisição LGPD).

**Fora da Fase 1**: analytics, enrichment, transcrição, agente conversacional, dashboard.

## Referências

- `AGENTS.md` — regras operacionais para agentes de IA no repo.
- `db/migrations/README.md` — fases de população por tabela + regras de concorrência.
- `docs/KIMI_RULES.md` — regras obrigatórias para o executor Kimi K2.
- `docs/phases/PHASE_01.md` — escopo detalhado da Fase 1.
- `docs/adr/` — decisões arquiteturais registradas.
