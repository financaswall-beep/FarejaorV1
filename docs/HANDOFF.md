# Handoff - Projeto Farejador

Atualizado: 25/04/2026

## Resumo

Farejador e a fundacao deterministica de dados do Chatwoot. O objetivo atual nao e
construir agente conversacional; e capturar, auditar, normalizar e permitir replay
confiavel de conversas para uso futuro em analytics e LLM.

## Stack

- TypeScript + Node.js
- Fastify
- Zod
- Supabase Postgres via `pg`
- Pino
- Vitest

## Invariantes

- `raw.raw_events` e auditavel e nao deve ser alterado fora dos campos operacionais de processamento.
- Toda tabela operacional tem `environment`.
- Dados de prod e test nao podem se misturar.
- Fase 1 nao chama LLM.
- Fase 1 nao escreve em `analytics.*`.
- Fase 1 nao popula `ops.enrichment_jobs`.
- LLM, quando existir, so escreve em `analytics.*`.

## Estado das fases

| Item | Status |
| --- | --- |
| F1-04 fixtures/testes | Concluido |
| F1-01 webhook ingestion | Concluido e validado contra Supabase |
| F1-02 normalizacao | Concluido, auditado e corrigido |
| F1-03 admin endpoints | Concluido, auditado, corrigido e publicado |
| Shadow mode Chatwoot real | Em andamento, conexao e normalizacao final validadas |

## F1-01 - entregue

- `POST /webhooks/chatwoot`.
- HMAC timing-safe via `X-Chatwoot-Signature` usando o formato oficial
  `timestamp.raw_body`.
- Janela de timestamp.
- Dedup por `X-Chatwoot-Delivery`.
- Insert em `raw.delivery_seen` + `raw.raw_events`.
- Resposta rapida sem normalizar no hot path.
- SSL no pool pg para Supabase.
- Testes unitarios e validacao E2E controlada.

## F1-02 - entregue

- Worker async em `src/normalization/worker.ts`.
- Dispatcher por event type.
- Mappers deterministicos.
- Repositories `core.*`.
- Watermark em contacts, conversations e messages.
- Stub de conversa para mensagem fora de ordem.
- Attachments ligados ao UUID de conversa retornado por `upsertMessage`.
- Status events e assignments idempotentes.
- Reaction mapper placeholder com `logger.warn` quando payload aparece.
- `SAVEPOINT normalize_event` preservado de proposito.
- Validacao final: `npm test` 60/60, `npm run typecheck`, `npm run build`.

## F1-03 - entregue

Endpoints admin implementados:

- `GET /healthz`
- `POST /admin/replay/:raw_event_id`
- `POST /admin/reconcile`

Regras criticas:

- `/healthz` nao exige auth.
- `/admin/*` exige bearer token com comparacao timing-safe.
- Replay so muda campos operacionais: `processing_status`, `processing_error`, `processed_at`.
- Reconcile injeta em raw, nunca escreve direto em core.
- Reconcile retorna resultado parcial com `aborted` e `abort_reason` em falha de paginacao.
- Validacao local final apos hardening: `npm test` 106/106, `npm run typecheck`,
  `npm run build`.

## Proxima etapa operacional

Antes de abrir Fase 2, validar a Fase 1 com dados reais controlados:

- Ler `docs/CHATWOOT_SHADOW_MODE_REPORT.md`.
- Rodar `/admin/replay/:raw_event_id` contra Supabase real e confirmar que nao duplica `core.*`.
- Rodar `/admin/reconcile` com janela pequena contra Chatwoot real e confirmar inserts em `raw.*`.
- Validar dois workers concorrentes com `FOR UPDATE SKIP LOCKED`.
- Manter shadow mode com webhooks reais por periodo combinado.

Status do shadow mode:

- Farejador publicado em Coolify.
- Chatwoot acessivel em `http://76.13.164.152/app/accounts/1/dashboard`.
- `/healthz` responde `ok`.
- Webhook real funcionou apos ajuste de HMAC oficial.
- Webhook da inbox API esta ligado para shadow mode.
- Filtro implementado no dispatcher e ativo no Coolify: `SKIP_EVENT_TYPES=message_updated`.
- Teste real final validou contato, conversa e mensagem:
  - `raw.raw_events`: `conversation_created` e `message_created` processados.
  - `core.contacts`: contato real criado.
  - `core.conversations`: conversa real vinculada ao contato.
  - `core.messages`: mensagem real vinculada a conversa e ao sender.
- Teste sintetico nivel 2 tambem foi executado no Supabase real com `environment=test`:
  - 10 cenarios de venda de pneus.
  - 49 raw_events sinteticos.
  - 49/49 `processed`, 0 `failed`.
  - Segunda execucao: 49/49 duplicatas ignoradas por `raw.delivery_seen`.
- Proximo passo operacional: monitorar shadow mode, testar replay real, testar reconcile real e validar concorrencia de worker.

## Fluxo recomendado para Kimi

Usar branch por task:

```text
feature/<id-task>-<slug>
```

Prompt base atualizado:

```text
Leia e obedeca docs/KIMI_RULES.md.

Leia tambem:
- docs/PROJECT.md
- docs/CONTRACTS.md
- docs/CONFIG.md
- docs/LOGGING.md
- docs/tasks/<TASK_ATUAL>.md

Sua tarefa e exclusivamente <TASK_ATUAL>.
Nao altere migrations.
Nao altere src/shared/types/chatwoot.ts.
Nao escreva fora das camadas autorizadas pela task.
Se a task for de Fase 1, nao escreva em analytics.* nem ops.enrichment_jobs.
Ao final entregue arquivos alterados, checklist, validacao, pendencias e riscos.
```

## Observacoes operacionais

- `.env.codex` existe localmente e nao deve ser commitado.
- Secrets nunca devem ser impressos em log.
- O repo remoto ja recebeu F1-01, F1-02 e F1-03.
- Preferir patches pequenos e auditaveis.
- Rotacionar secrets antes de producao plena, pois credenciais foram manipuladas
  manualmente durante os testes de conexao.
