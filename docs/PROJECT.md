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
- Fase 2a: iniciada. F2A-01 e F2A-02 concluidas, auditadas e publicadas.
- Proxima entrega: F2A-03 classificacoes deterministicas genericas.

Validacao atual:

- `npm test`: 170/170.
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
- SSL usa `rejectUnauthorized:false` com Supabase pooler; `DATABASE_CA_CERT` foi removido porque o pooler nao suporta validacao de cadeia.
- `ops.orphan_conversation_stubs` e `ops.report_orphan_stubs()` monitoram stubs de conversa.

## Ressalvas antes de producao plena

- Manter shadow mode por periodo combinado e monitorar `pending`, `failed`, `skipped`, stubs orfaos e latencia da fila.
- Rotacao de secrets dispensada para a base: o fork operacional sera criado em repositorio novo e usara secrets novos por construcao.
- Harness de integracao automatizado com Postgres real criado via Testcontainers; execucao local depende de Docker Desktop e CI roda via GitHub Actions.
- Migrar mappers criticos para Zod permissivo e limpar o caminho legado de body dos testes.

## Decisoes iniciais da F2a

- F2a comecou por sinais estruturais genericos em `analytics.conversation_signals`.
- O nucleo de enrichment fica em `src/enrichment/*`.
- Regras de negocio ficam em `segments/*`.
- A selecao de segmento usa `segments/routing.json` por `environment + chatwoot_account_id`.
- O primeiro pacote de segmento de pneus so deve nascer depois da fronteira do fork.
- A fronteira do fork acontece ao fim da F2A-03, quando signals, regras e classificacoes genericas existirem sem regras de pneus.
- F2A-01 adicionou o CLI `npm run enrich -- --conversation-id=<uuid> --segment=generic`; nesta entrega, `--segment` e aceito e ignorado com log claro.
- F2A-02 criou `segments/generic`, `segments/_template`, `segments/routing.json`, loader/engine de regras e repositories de `analytics.linguistic_hints` e `analytics.conversation_facts`.
- A migration `0010_analytics_ruleset_auditability.sql` adiciona `ruleset_hash` e idempotencia de hints; foi aplicada e validada no Supabase real.

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
- `docs/phases/PHASE_02A.md`
- `docs/F2A_ARCHITECTURE.md`
- `docs/F2A_KIMI_IMPLEMENTATION_GUIDE.md`
- `docs/tasks/F1-03-admin.md`
- `docs/tasks/F2A-01-conversation-signals.md`
- `docs/adr/`
