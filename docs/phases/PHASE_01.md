# Fase 1 - Farejador deterministico (MVP)

## Status atual

- F1-04 fixtures/testes base: concluida.
- F1-01 webhook ingestion: concluida, validada contra Supabase e publicada.
- F1-02 normalizacao: concluida, auditada, corrigida e publicada.
- F1-03 admin endpoints: concluida, auditada, corrigida e publicada.
- Shadow mode real: em andamento, com conexao Chatwoot -> Farejador -> Supabase validada.

## Objetivo

Receber webhooks do Chatwoot, validar autenticidade, deduplicar, persistir payload
bruto e normalizar para tabelas operacionais `core.*`. Tudo deterministico, zero LLM.

## Entregaveis da Fase 1

- Endpoint HTTP `POST /webhooks/chatwoot`.
- Persistencia em `raw.raw_events`.
- Dedup via `raw.delivery_seen`.
- Worker async de normalizacao para `core.*`.
- Endpoints admin de health, replay e reconcile.
- Testes com fixtures sinteticas representativas.

## Fora de escopo

- Escrita em `analytics.*`.
- Chamada de LLM.
- Agente conversacional.
- Dashboard/UI.
- Transcricao de audio.
- Microservicos.

## Ordem de execucao

1. F1-04 - Fixtures e testes base.
2. F1-01 - Webhook end-to-end.
3. F1-02 - Worker de normalizacao.
4. F1-03 - Endpoints admin.

## F1-02 - resumo do fechamento

- Worker usa `FOR UPDATE SKIP LOCKED`.
- Cada raw_event tem transacao propria.
- `SAVEPOINT normalize_event` e intencional para desfazer writes parciais e ainda marcar `failed`.
- Mensagens fora de ordem criam stub de conversa.
- Attachments recebem o UUID de conversa retornado por `upsertMessage`.
- Reactions ainda sao placeholder, mas payload recebido gera `logger.warn`.
- Validacao: 60 testes, typecheck e build verdes.

## F1-03 - resumo do fechamento

- `/healthz` implementado sem auth, com check de DB.
- `/admin/replay/:id` protegido por bearer, com reset de campos operacionais.
- `/admin/reconcile` protegido por bearer, com janela maxima de 7 dias.
- Cliente Chatwoot usa `fetch` nativo, timeout de 10s e retry em 429/5xx.
- Reconcile injeta somente raw_events sinteticos e usa `raw.delivery_seen` para dedup.
- Reconcile explicita resultado parcial com `aborted`/`abort_reason` quando a paginacao falha.
- Validacao local apos hardening: 112 testes, typecheck e build verdes.

## Shadow mode real - resumo atual

- Farejador publicado no Coolify.
- Supabase acessado pelo Connection Pooler com SSL.
- `/healthz` responde `ok` em `prod`.
- Webhook real do Chatwoot validado com assinatura oficial `timestamp.raw_body`.
- `SKIP_EVENT_TYPES=message_updated` ativo para reduzir ruido operacional.
- Payload real aninhado do Chatwoot tratado nos mappers/dispatcher.
- Teste final validou:
  - `raw.raw_events` com `conversation_created` e `message_created` processados;
  - `core.contacts` populada;
  - `core.conversations` vinculada ao contato;
  - `core.messages` vinculada a conversa e ao sender.
- Replay real validou reprocessamento sem duplicar `core.messages`.
- Reconcile real validou insercao de eventos sinteticos, idempotencia por
  `raw.delivery_seen` e dedup de mensagens por `chatwoot_message_id`.

## Criterios restantes para concluir a Fase 1

1. Teste/integracao com dois workers concorrentes usando Postgres real.
2. Shadow mode com webhooks reais por periodo combinado.
3. Rotacao de secrets antes de producao plena.

## Fim da Fase 1

A Fase 1 esta tecnicamente entregue e em validacao operacional final. Ela deve ser
considerada fechada quando concorrencia de worker for validada, secrets forem
rotacionados e um periodo curto de shadow mode nao mostrar perdas, duplicacoes ou
fila travada.

Depois disso, a proxima fase e a **Fase 2a - enrichment deterministico**, escrevendo
somente em `analytics.*`, ainda sem LLM.
