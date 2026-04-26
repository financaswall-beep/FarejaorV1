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
| F1.5 hardening | Concluido, publicado e documentado |
| Fase 1 tecnica | Concluida |
| Shadow mode Chatwoot real | Em andamento como ressalva operacional antes de producao plena |
| F2A-01 conversation signals | Concluida, auditada e publicada |
| F2A-02 motor generico de regras | Concluida, auditada e validada no Supabase |
| Fase 2a proxima entrega | F2A-03 classificacoes deterministicas genericas |

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
- Validacao local final apos hardening: `npm test` 112/112, `npm run typecheck`,
  `npm run build`.

## Proxima etapa operacional

A Fase 2a foi iniciada. Em paralelo, manter as ressalvas operacionais da Fase 1
antes de declarar producao plena.

Entrega concluida:

- F2A-01 `conversation_signals` genericos.
- Codigo publicado no commit `bc44f4c`.
- Validacao: `npm run typecheck`, `npm test` 133/133 e `npm run build`.
- Task detalhada e auditoria em `docs/tasks/F2A-01-conversation-signals.md`.

Entrega concluida:

- F2A-02 motor generico de regras declarativas.
- Usar `docs/tasks/F2A-02-generic-rule-engine.md`.
- Nao criar regras de pneu ainda.
- Validacao local: `npm run typecheck`, `npm test` 170/170 e `npm run build`.
- Supabase real: migration `0010_analytics_ruleset_auditability.sql` aplicada e validada.
- Validado no banco: `ruleset_hash` em hints/facts, `pattern_id NOT NULL`, constraint `hints_dedup_key`, 0 `pattern_id` nulo e dedup de hints via `ON CONFLICT`.

Proxima entrega recomendada:

- F2A-03 classificacoes deterministicas genericas.
- Usar `docs/tasks/F2A-03-generic-classifications.md`.
- Ainda nao criar regras de pneu.
- Ainda nao criar tag/fork; a fronteira vem somente depois da F2A-03.

Fronteira do fork:

- Parar ao fim da F2A-03.
- Avisar Wallace antes de criar `segments/tires`.
- Criar tag `farejador-base-v1` se aprovado e se checklist operacional estiver verde.

Ja validado com dados reais:

- `POST /webhooks/chatwoot` contra Chatwoot/Supabase reais.
- `/admin/replay/:raw_event_id` sem duplicar `core.*`.
- `/admin/reconcile` com janela pequena contra Chatwoot real.
- Dois workers concorrentes com `FOR UPDATE SKIP LOCKED`.

Ainda pendente antes de producao plena:

- Manter shadow mode com webhooks reais por periodo combinado.
- Rotacionar secrets.
- Configurar `DATABASE_CA_CERT`.
- Criar harness de integracao automatizado com Postgres real.

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
- Replay real validado:
  - raw_event `111` reprocessado via `/admin/replay/111`.
  - `core.messages` da conversa 8 permaneceu sem duplicacao.
- Reconcile real validado em janela pequena:
  - primeira execucao inseriu eventos sinteticos de reconcile.
  - segunda execucao retornou `inserted=0`, `skipped_duplicate=12`, `errors=[]`.
  - bug de duplicacao por precisao de timestamp foi corrigido antes do fechamento.
- Concorrencia de worker validada contra Supabase real com `environment=test`:
  - 80 raw_events sinteticos.
  - 2 workers executados em paralelo.
  - 80/80 `processed`.
  - 0 duplicatas em `core.messages`.
- Proximo passo operacional: continuar Fase 2a sem LLM em paralelo ao shadow mode, monitorar operacao e rotacionar secrets antes de producao plena.

## F1.5 - Hardening aplicado em 2026-04-25

Auditoria tecnica completa + hardening deployado antes de producao plena.

### Migrations aplicadas no Supabase (nao requerem redeploy futuro):

- `0007_raw_immutability_guard.sql`: trigger `raw.enforce_raw_event_immutability` impede UPDATE em colunas de identidade/payload e impede DELETE em `raw.raw_events`. Validado: rejeita UPDATE com ERRCODE restrict_violation (23001).
- `0008_idempotency_constraints.sql`: UNIQUE constraints atomicas em `core.conversation_status_events` e `core.conversation_assignments`. Fecha race condition de dedup concorrente que `WHERE NOT EXISTS` nao cobria.
- `0009_orphan_stub_monitor.sql`: view `ops.orphan_conversation_stubs` e funcao `ops.report_orphan_stubs()`. Monitor de conversas-stub sem `last_event_at` (criadas quando message_created chegou antes de conversation_created).

### Codigo deployado (commit 66b9537):

- Reconcile usa `reconcile-v2:tipo:env:account_id:id:ts` — inclui `account_id` para evitar colisao cross-account.
- Status events e assignments usam `ON CONFLICT ON CONSTRAINT ... DO NOTHING` nos repositories — a constraint do banco protege concorrencia sem transformar replay/duplicata em `failed`.
- `DATABASE_CA_CERT` via env: SSL com validacao de certificado quando configurado. Aviso em prod sem CA.
- `first_seen_at` em `core.contacts` nao zera mais no UPDATE.
- `MAX_PER_POLL` (era `BATCH_SIZE`): nome correto, comentario explicando comportamento de drenagem.

### Estado atual do banco (Supabase Farejador aoqtgwzeyznycuakrdhp):

- `raw.raw_events`: 157 linhas, imutabilidade enforced no banco.
- `core.contacts`: 94 linhas (prod).
- `core.conversations`: 92 linhas (prod) + 80 stubs de teste (environment=test).
- `core.messages`: 118 linhas (prod).
- Stubs orfaos: 80 em environment=test, IDs Chatwoot 1200200-1200279, do teste de concorrencia de 25/04.

### Pendente da F1.5 (antes de producao plena):

1. Harness de integracao com Postgres real — testes automatizados que rodam SQL real.
2. Zod permissivo nos mappers criticos — schemas com `.passthrough()` nos mappers de contact, conversation e message.
3. Limpar body legado do handler e migrar testes para caminho real de producao.
4. Configurar `DATABASE_CA_CERT` no Coolify.

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
- docs/F2A_ARCHITECTURE.md
- docs/F2A_KIMI_IMPLEMENTATION_GUIDE.md
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
- O repo remoto ja recebeu F1-01, F1-02, F1-03 e F1.5.
- Preferir patches pequenos e auditaveis.
- Rotacionar secrets antes de producao plena, pois credenciais foram manipuladas
  manualmente durante os testes de conexao.
