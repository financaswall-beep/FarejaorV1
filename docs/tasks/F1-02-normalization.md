# F1-02 — Worker de normalização raw → core

## Objetivo
Ler `raw.raw_events` com `processing_status='pending'` e popular as tabelas `core.*`
via upsert idempotente com watermark de ordem.

## Escopo

**Inclui:**
- Loop worker em `src/normalization/worker.ts` que puxa pending, normaliza, marca
  processed/failed
- Mapeadores por entidade em `src/normalization/*.mapper.ts`
- Repositories com upsert em `src/persistence/*.repository.ts`
- Dispatcher por event_type em `src/normalization/dispatcher.ts`

**Não inclui:**
- Escrita em `analytics.*`
- Escrita em `ops.enrichment_jobs` (fica pra Fase 2 — worker só popula core)
- Endpoints admin (F1-03)

## Arquivos que pode criar/editar

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
- `src/app/server.ts` (apenas para boot do worker em paralelo ao HTTP)

## Arquivos que NÃO deve mexer

- `src/shared/types/chatwoot.ts` (importar, nunca alterar)
- `db/migrations/**`
- `src/webhooks/**` (handler já existe; não mexer)
- `package.json`
- Qualquer coisa em `src/admin/`

## Regras específicas

1. **Upsert sempre idempotente**. Use `INSERT ... ON CONFLICT (env, chatwoot_<entity>_id) DO UPDATE`.
2. **Watermark obrigatório**. Todo upsert em `core.contacts/conversations/messages`
   inclui `last_event_at` (valor = `X-Chatwoot-Timestamp` do raw event ou `updated_at`
   do payload). O trigger `core.skip_stale_update` já barra regressão — sua
   responsabilidade é passar o valor.
3. **Redundância defensiva** no SQL: use `WHERE EXCLUDED.last_event_at >= core.X.last_event_at`
   no `DO UPDATE`. Trigger + WHERE = dupla proteção.
4. **Mapeamento 1:1 e puro**. Mapper recebe payload + metadata, retorna shape pro
   repository. Nenhum I/O dentro do mapper.
5. **Dispatcher por `event_type`**:
   - `contact_created` / `contact_updated` → contact.mapper + contacts.repo
   - `conversation_created` / `conversation_updated` / `conversation_status_changed` →
     conversation.mapper + conversations.repo (+ status-event quando status muda)
   - `message_created` / `message_updated` → message.mapper + messages.repo (+ attachments
     se houver)
6. **Erro não para o worker**. Falha em uma linha = marca `failed` com `processing_error`
   e `processed_at = now()`, segue pra próxima.
7. **Worker puxa em lotes**. `SELECT ... WHERE processing_status='pending' ORDER BY received_at LIMIT 50 FOR UPDATE SKIP LOCKED`.
8. **Marca processed** quando todas as escritas em `core.*` daquele evento concluíram
   com sucesso (transação única por raw_event).
9. **Sem chamada de LLM. Sem chamada externa. Sem transcrição.** Tudo determinístico.
10. Se o dispatcher recebe `event_type` desconhecido → marca `skipped`, loga warn.

## Contratos de upsert (referência)

```sql
-- contacts
INSERT INTO core.contacts (environment, chatwoot_contact_id, name, phone_e164, ..., last_event_at)
VALUES ($1, $2, $3, $4, ..., $N)
ON CONFLICT (environment, chatwoot_contact_id) DO UPDATE
SET name = EXCLUDED.name,
    phone_e164 = EXCLUDED.phone_e164,
    ...,
    last_event_at = EXCLUDED.last_event_at,
    updated_at = now()
WHERE EXCLUDED.last_event_at >= core.contacts.last_event_at;
```

Mesmo padrão para `conversations` e `messages`. Para tabelas sem watermark
(`message_attachments`, `conversation_tags`, `conversation_status_events`,
`conversation_assignments`, `message_reactions`) use upsert direto sem watermark —
essas são append-only ou têm chave natural única.

## Checklist

- [ ] Worker boota junto com HTTP (mesmo processo, Fase 1) ou como job separado
      chamando o mesmo bundle
- [ ] Worker puxa pending com `FOR UPDATE SKIP LOCKED`
- [ ] Dispatcher roteia por event_type
- [ ] Mapper de contact implementado
- [ ] Mapper de conversation implementado
- [ ] Mapper de message implementado
- [ ] Mapper de attachment implementado
- [ ] Mapper de status event implementado
- [ ] Mapper de assignment implementado
- [ ] Mapper de reaction implementado
- [ ] Mapper de tag implementado
- [ ] Upserts com watermark em contacts/conversations/messages
- [ ] Upserts idempotentes em todas as demais
- [ ] Erro em linha marca `failed` com `processing_error` não vazio
- [ ] Sucesso marca `processed` com `processed_at`
- [ ] event_type desconhecido marca `skipped`

## Critérios de aceite

1. Evento `message_created` em raw → aparece em `core.messages` com `message_type_name`
   correto e `last_event_at` populado.
2. Evento `message_updated` do mesmo `chatwoot_message_id` com timestamp maior →
   atualiza a linha.
3. Evento `message_updated` com timestamp menor que o atual → UPDATE vira no-op
   (trigger dispara NOTICE, linha não muda).
4. Evento `contact_created` seguido de `contact_updated` → `core.contacts` tem 1 linha
   com dados do update.
5. Evento `conversation_status_changed` → gera linha em `core.conversation_status_events`
   **e** atualiza `core.conversations.current_status`.
6. Evento com payload inválido → marca `failed` com mensagem legível, worker segue.
7. `raw.raw_events` com `processing_status='processed'` não é re-processado.
8. Dois workers rodando em paralelo não pegam o mesmo raw_event (SKIP LOCKED).

## Formato obrigatório de resposta

Mesmo formato de F1-01 (arquivos / checklist / pendências / riscos).
