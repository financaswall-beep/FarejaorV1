# Fase 1 - Farejador deterministico (MVP)

## Status atual

- F1-04 fixtures/testes base: concluida.
- F1-01 webhook ingestion: concluida, validada contra Supabase e publicada.
- F1-02 normalizacao: concluida, auditada, corrigida e publicada.
- F1-03 admin endpoints: implementada no codigo local.

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
- Validacao local: 95 testes, typecheck e build verdes.

## Criterios restantes para concluir a Fase 1

1. Teste manual/integracao com Chatwoot real para `/admin/reconcile`.
2. Validacao real em Supabase cobrindo replay, mensagem fora de ordem, attachment, status change e dedup.
3. Shadow mode com webhooks reais por periodo combinado.

## Fim da Fase 1

A Fase 1 termina quando F1-03 estiver implementada e um periodo de shadow mode com
webhooks reais nao mostrar perdas ou duplicacoes relevantes.
