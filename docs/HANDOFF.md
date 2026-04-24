# Handoff - Projeto Farejador

Atualizado: 24/04/2026

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
| F1-03 admin endpoints | Proximo |

## F1-01 - entregue

- `POST /webhooks/chatwoot`.
- HMAC timing-safe via `X-Chatwoot-Signature`.
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

## Proxima tarefa: F1-03

Implementar endpoints admin:

- `GET /healthz`
- `POST /admin/replay/:raw_event_id`
- `POST /admin/reconcile`

Regras criticas:

- `/healthz` nao exige auth.
- `/admin/*` exige bearer token com comparacao timing-safe.
- Replay so muda campos operacionais: `processing_status`, `processing_error`, `processed_at`.
- Reconcile injeta em raw, nunca escreve direto em core.
- Validar idempotencia real no caminho de replay.

## Fluxo recomendado para Kimi

Usar branch:

```text
feature/F1-03-admin
```

Prompt base:

```text
Leia e obedeca docs/KIMI_RULES.md.

Leia tambem:
- docs/PROJECT.md
- docs/CONTRACTS.md
- docs/CONFIG.md
- docs/LOGGING.md
- docs/tasks/F1-03-admin.md

Sua tarefa e exclusivamente F1-03.
Nao altere migrations.
Nao altere src/shared/types/chatwoot.ts.
Nao escreva em analytics.* nem ops.enrichment_jobs.
Ao final entregue arquivos alterados, checklist, validacao, pendencias e riscos.
```

## Observacoes operacionais

- `.env.codex` existe localmente e nao deve ser commitado.
- Secrets nunca devem ser impressos em log.
- O repo remoto ja recebeu F1-01 e F1-02.
- Preferir patches pequenos e auditaveis.
