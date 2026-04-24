# F1-02 - Worker de normalizacao raw -> core

## Status

Concluida e publicada em `main`.

Commit base da entrega: `d337c73 feat: implement F1-02 deterministic normalization`.
Patch final de hardening aplicado depois da auditoria Opus/Codex:

- `upsertMessage()` retorna `{ messageId, conversationId }`.
- `upsertAttachment()` recebe `conversationId` UUID direto, sem subselect para `core.conversations`.
- Payloads de reaction nao somem silenciosamente: enquanto `reaction.mapper` for placeholder, o dispatcher loga `warn`.
- Log de event type desconhecido usa ASCII para evitar renderizacao ruim em consoles Windows.
- Validacao local: `npm test` 60/60, `npm run typecheck`, `npm run build`.

## Objetivo

Ler `raw.raw_events` com `processing_status='pending'` e popular as tabelas `core.*`
via upsert idempotente com watermark de ordem.

## Escopo entregue

- Worker em `src/normalization/worker.ts`.
- Dispatcher por `event_type` em `src/normalization/dispatcher.ts`.
- Mappers deterministicos em `src/normalization/*.mapper.ts`.
- Repositories de escrita em `src/persistence/*.repository.ts`.
- Boot do worker no mesmo processo HTTP em `src/app/server.ts`.
- Testes unitarios de normalizacao, dispatcher, worker e repositories.

## Invariantes confirmadas

- Sem escrita em `analytics.*`.
- Sem escrita em `ops.enrichment_jobs`.
- Sem chamada LLM.
- Sem chamada externa.
- `raw.raw_events` continua sendo gravado primeiro pela F1-01.
- Normalizacao roda assincronamente depois da persistencia raw.
- Worker usa `FOR UPDATE SKIP LOCKED`.
- Cada raw_event processado tem sua propria transacao.
- `SAVEPOINT normalize_event` e intencional: em caso de erro no dispatch, desfaz writes parciais em `core.*`, mantem o lock do raw_event e permite marcar a linha como `failed` na mesma transacao.

## Comportamento implementado

- `contact_created` / `contact_updated` -> `core.contacts`.
- `conversation_created` / `conversation_updated` / `conversation_status_changed` -> `core.conversations`, status events, assignments e tags quando aplicavel.
- `message_created` / `message_updated` -> `core.messages`, attachments e reactions quando aplicavel.
- Mensagem fora de ordem cria uma conversa minima antes do insert em `core.messages`.
- A conversa minima nasce com `last_event_at = NULL`, permitindo que um evento completo posterior preencha a linha.
- `sender_type` e normalizado para valores aceitos pelo banco; fallback seguro: `system`.
- Eventos desconhecidos viram `skipped`.
- Erros de normalizacao viram `failed` com `processing_error`.

## Pontos deliberadamente deixados para F1-03

- Teste de integracao real com Supabase para replay, idempotencia e `SKIP LOCKED` concorrente.
- Reprocessamento administrativo via endpoint.
- Reconcile via API Chatwoot.
- Implementacao real de reactions, caso o Chatwoot passe a enviar payloads relevantes.

## Arquivos principais

- `src/normalization/worker.ts`
- `src/normalization/dispatcher.ts`
- `src/normalization/contact.mapper.ts`
- `src/normalization/conversation.mapper.ts`
- `src/normalization/message.mapper.ts`
- `src/normalization/attachment.mapper.ts`
- `src/normalization/status-event.mapper.ts`
- `src/normalization/assignment.mapper.ts`
- `src/normalization/reaction.mapper.ts`
- `src/normalization/tag.mapper.ts`
- `src/persistence/contacts.repository.ts`
- `src/persistence/conversations.repository.ts`
- `src/persistence/messages.repository.ts`
- `src/persistence/attachments.repository.ts`
- `src/persistence/status-events.repository.ts`
- `src/persistence/assignments.repository.ts`
- `src/persistence/reactions.repository.ts`
- `src/persistence/tags.repository.ts`
- `tests/unit/normalization/*`
- `tests/unit/persistence/*`

## Checklist final

- [x] Worker boota junto com HTTP.
- [x] Worker puxa pending com `FOR UPDATE SKIP LOCKED`.
- [x] Dispatcher roteia por event_type.
- [x] Mapper de contact implementado.
- [x] Mapper de conversation implementado.
- [x] Mapper de message implementado.
- [x] Mapper de attachment implementado.
- [x] Mapper de status event implementado.
- [x] Mapper de assignment implementado.
- [x] Mapper de reaction implementado como placeholder rastreavel.
- [x] Mapper de tag implementado.
- [x] Upserts com watermark em contacts/conversations/messages.
- [x] Upserts idempotentes nas demais tabelas.
- [x] Erro em linha marca `failed` com `processing_error`.
- [x] Sucesso marca `processed` com `processed_at`.
- [x] Event type desconhecido marca `skipped`.
- [x] Attachments usam o UUID de conversa retornado pelo upsert da mensagem.
- [x] Reactions placeholder geram `logger.warn`.

## Validacao

```text
npm test           -> 60/60 passando
npm run typecheck  -> verde
npm run build      -> verde
```
