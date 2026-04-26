# Checklist Master - Farejador

Atualizado: 26/04/2026

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
- [x] `npm test` 112/112.
- [x] `npm run typecheck` verde.
- [x] `npm run build` verde.
- [x] Teste manual com Chatwoot real e Supabase real para webhook, contato, conversa e mensagem.

## 5. Fechamento da Fase 1 tecnica

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
- [x] Replay real nao duplica `core.messages`: raw_event `111` reprocessado, contagem da conversa 8 permaneceu estavel.
- [x] Reconcile real em janela pequena injeta `raw_events` e e idempotente: primeira rodada inseriu reconcile events; segunda rodada retornou `inserted=0`, `skipped_duplicate=12`.
- [x] Bug real de duplicacao por precisao de timestamp corrigido em `core.messages`; replay dos eventos reconcile nao recriou duplicatas.
- [x] Dois workers concorrentes validados contra Supabase real em `environment=test`: 80 raw_events, 80 `processed`, 0 duplicatas em `core.messages`.
- [x] Fase 1 tecnica concluida e apta a abrir Fase 2a.

Ressalvas antes de producao plena:

- [ ] Shadow mode com webhooks reais por periodo combinado.
- [x] ~~Rotacionar secrets antes de producao plena.~~ Dispensado em 26/04/2026: o repo base `farejador-base-v1` sera arquivado como template; fork operacional sera repo novo com secrets novos por construcao.
- [x] ~~Configurar `DATABASE_CA_CERT` no Coolify para SSL com validacao de certificado.~~ Resolvido em 26/04/2026: Supabase connection pooler nao suporta validacao de cadeia. SSL permanece ativo via `rejectUnauthorized:false` (conexao criptografada). Variavel removida do `env.ts` e do `db.ts`.

## 5.1 F1.5 - Hardening pre-producao plena (2026-04-25)

Auditoria tecnica completa realizada antes de producao plena. Itens aplicados e deployados:

- [x] Trigger `raw.enforce_raw_event_immutability` em `raw.raw_events`: bloqueia UPDATE em payload/event_type/delivery_id e bloqueia DELETE. Whitelist: `processing_status`, `processing_error`, `processed_at`. Propagado para todas as particoes. Validado no Supabase real (rejeitou UPDATE em id=174).
- [x] UNIQUE constraint `status_events_dedup_key` em `core.conversation_status_events (environment, chatwoot_conversation_id, event_type, occurred_at)`: fecha race condition de dedup concorrente.
- [x] UNIQUE constraint `assignments_dedup_key` em `core.conversation_assignments (environment, conversation_id, agent_id, assigned_at)`: idem.
- [x] Repositories de status events e assignments usam `ON CONFLICT ON CONSTRAINT ... DO NOTHING`: duplicata concorrente vira no-op idempotente, nao `failed`.
- [x] Reconcile delivery_id versionado: formato `reconcile-v2:tipo:env:account_id:id:ts` inclui `account_id` para evitar colisao cross-account.
- [x] SSL com `DATABASE_CA_CERT` via env: `rejectUnauthorized:true` quando CA configurado; aviso em prod sem CA (nao bloqueia ainda — configurar antes de producao plena).
- [x] `first_seen_at` em `core.contacts`: nao zera mais no `ON CONFLICT DO UPDATE`; `COALESCE(now())` no INSERT garante preenchimento na primeira vez.
- [x] `MAX_PER_POLL` (renomeado de `BATCH_SIZE`): comportamento documentado — encerra ciclo cedo se fila vazia, nao e limite de tentativas.
- [x] View `ops.orphan_conversation_stubs` + funcao `ops.report_orphan_stubs()`: detecta conversas-stub com `last_event_at IS NULL` ha mais de 10 minutos. 80 stubs de teste identificados (environment=test, conc. test 25/04).
- [x] `db/migrations/README.md` atualizado: 0007 e 0008 na lista de ordem; pg_cron marcado como requisito de producao (nao opcional).
- [x] `.env.example` atualizado com `DATABASE_CA_CERT` e instrucoes de obtencao do cert Supabase.

Pendente da F1.5:
- [ ] Harness de integracao com Postgres real (testes automatizados contra banco real).
- [ ] Zod permissivo nos mappers criticos (contact, conversation, message).
- [ ] Limpar body legado do handler e migrar testes para caminho real de producao.

## 6. Futuro

- [ ] Fase 2a: enrichment deterministico em `analytics.*`.
  - [x] Arquitetura F2a documentada.
  - [x] Guia de implementacao para Kimi documentado.
  - [x] Prompt F2A-01 criado.
  - [x] F2A-01: `conversation_signals` genericos implementado, auditado e publicado.
  - [x] F2A-02: motor generico de regras declarativas, routing, `_template` e UNIQUE de hints.
  - [x] Auditoria pos-F2A-02: migration `0011` relaxa CHECK de `hint_type`; `SIGNAL_TIMEZONE` parametrizado; `SEGMENTS_BASE` via `import.meta.url`.
  - [x] F2A-03: classificacoes deterministicas genericas.
  - [x] F2A-04: fronteira do fork — checklist tecnico verde (typecheck/test 192/192/build, sem `segments/tires`, sem vocabulario de pneu em `src/enrichment`, `generic` + `_template` presentes, migrations 0011/0012 aplicadas, `SIGNAL_TIMEZONE` documentado, `rules.loader` via `import.meta.url`). Tag `farejador-base-v1` aguardando checklist operacional (shadow contínuo, secrets rotation, `DATABASE_CA_CERT`, harness integração).
  - [ ] F2A-05: pacote `segments/tires` somente depois da tag.
- [ ] Fase 2b: enrichment com LLM escrevendo somente em `analytics.*`.
- [ ] Fase 3: agente conversacional separado, read-only sobre Farejador.
