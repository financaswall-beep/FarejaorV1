# F1-01 — Webhook end-to-end

## Objetivo
Criar o endpoint `POST /webhooks/chatwoot` que recebe eventos do Chatwoot, valida
HMAC e timestamp, deduplica, persiste em `raw.raw_events` e responde 2xx rápido.

## Escopo

**Inclui:**
- Boot do Fastify em `src/app/server.ts`
- Rota `POST /webhooks/chatwoot` em `src/webhooks/chatwoot.route.ts`
- Handler em `src/webhooks/chatwoot.handler.ts`
- Validação HMAC em `src/webhooks/chatwoot.hmac.ts`
- Repository de raw events em `src/persistence/raw-events.repository.ts` (inclui dedup via CTE `claim` em `raw.delivery_seen`)
- Boot do pool `pg` em `src/persistence/db.ts`
- Validação de env vars em `src/shared/config/env.ts`
- Setup de logger em `src/shared/logger.ts`

**Não inclui:**
- Normalização para `core.*` (é a F1-02)
- Endpoints admin (é a F1-03)
- Testes (é a F1-04, mas você pode criar estrutura mínima de teste se necessário
  para validar o handler localmente)
- Qualquer escrita em `analytics.*` ou `ops.enrichment_jobs`

## Arquivos que pode criar/editar

- `src/app/server.ts`
- `src/app/routes.ts` (só registra a rota do webhook)
- `src/webhooks/chatwoot.route.ts`
- `src/webhooks/chatwoot.handler.ts`
- `src/webhooks/chatwoot.hmac.ts`
- `src/persistence/db.ts`
- `src/persistence/raw-events.repository.ts` (inclui dedup via CTE `claim` em `raw.delivery_seen`)
- `src/shared/config/env.ts`
- `src/shared/logger.ts`

## Arquivos que NÃO deve mexer

- `src/shared/types/chatwoot.ts` (contrato já definido — apenas importe)
- `db/migrations/**` (migrations estão congeladas)
- `package.json` (não adicione dependência nova sem autorização)
- `tsconfig.json`
- Qualquer arquivo em `src/normalization/`, `src/admin/`, `src/enrichment/` (não existem nesta task)

## Regras específicas

1. Responder 2xx **antes** de qualquer trabalho pesado. Insert em `raw.raw_events` é
   rápido; normalização roda depois (F1-02 fará disso um worker separado).
2. **Dedup primeiro**: antes de inserir em `raw.raw_events`, fazer `INSERT ... ON CONFLICT DO NOTHING`
   em `raw.delivery_seen`. Se não inseriu, descarta e responde 200 mesmo assim
   (não é erro — é retry legítimo do Chatwoot).
3. **HMAC failure = 401**, sem insert em lugar nenhum.
4. **Timestamp expirado = 401**, sem insert em lugar nenhum. Usar
   `CHATWOOT_WEBHOOK_MAX_AGE_SECONDS` (default 300).
5. **Payload inválido (Zod falha no envelope) = 400**, sem insert.
6. **Erro de DB = 500**, Fastify loga e responde. Chatwoot vai tentar de novo.
7. Logging segue `docs/LOGGING.md`. Pino JSON, sem vazar payload em `info`.
8. Toda leitura de env var via `src/shared/config/env.ts` (Zod-validated). Zero
   `process.env.X` direto fora desse arquivo.
9. Pool `pg` compartilhado. Queries usam prepared statements (`pg` já faz).

## Fluxo do handler (referência)

```
1. Ler raw body (precisa do bytes exato pra HMAC — não pode re-serializar JSON)
2. Ler headers: x-chatwoot-signature, x-chatwoot-timestamp, x-chatwoot-delivery
3. Verificar timestamp <= MAX_AGE_SECONDS → senão 401
4. Verificar HMAC(raw_body, secret) == signature → senão 401
5. Parsear JSON → validar com chatwootWebhookEnvelopeSchema → senão 400
6. BEGIN tx
   a. INSERT INTO raw.delivery_seen (env, delivery_id) ON CONFLICT DO NOTHING RETURNING 1
   b. Se 0 linhas → ROLLBACK, log warn 'duplicate', responde 200
   c. INSERT INTO raw.raw_events (...) com processing_status='pending'
   d. UPDATE raw.delivery_seen SET raw_event_id = inserted_id
   COMMIT
7. Responde 200 com { received: true, delivery_id }
```

**Importante**: Fastify reconstrói o body via parser JSON por padrão — você precisa
do **raw body** para o HMAC. Use `addContentTypeParser` nativo do Fastify com
`parseAs: 'buffer'` para capturar o Buffer original e fazer o parse JSON manualmente.
**Não adicione nenhum pacote externo para isso** — o Fastify resolve nativamente:

```ts
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (_req, body, done) => {
    try {
      done(null, { raw: body, parsed: JSON.parse(body.toString()) });
    } catch (err) {
      done(err as Error);
    }
  }
);
```

O handler acessa `request.body.raw` (Buffer para HMAC) e `request.body.parsed` (objeto).

## Checklist

- [ ] Fastify boota e registra rota `POST /webhooks/chatwoot`
- [ ] Env vars validadas no boot (falha dura se faltarem)
- [ ] Logger pino configurado com redaction de secrets
- [ ] Pool `pg` inicializado com `DATABASE_URL`
- [ ] Raw body preservado para HMAC
- [ ] HMAC validado com `CHATWOOT_HMAC_SECRET` (timing-safe compare)
- [ ] Timestamp rejeitado se mais antigo que `CHATWOOT_WEBHOOK_MAX_AGE_SECONDS`
- [ ] Envelope parseado com `chatwootWebhookEnvelopeSchema`
- [ ] Bouncer `raw.delivery_seen` usado antes de `raw.raw_events`
- [ ] Duplicata retorna 200 sem erro
- [ ] Insert em `raw.raw_events` com `processing_status='pending'`
- [ ] Resposta 2xx vem antes de qualquer trabalho além do insert
- [ ] Shutdown gracioso (SIGTERM fecha pool `pg` e servidor Fastify)

## Critérios de aceite

1. Handler local (rodando com `npm run dev`) aceita um POST com HMAC válido → linha
   aparece em `raw.raw_events` e `raw.delivery_seen`.
2. Mesmo POST repetido → `raw.raw_events` **não** ganha segunda linha; `raw.delivery_seen`
   tem a mesma linha com mesmo `first_seen_at`.
3. POST com assinatura errada → 401, zero escrita em qualquer tabela.
4. POST com `x-chatwoot-timestamp` de 10 minutos atrás → 401.
5. POST com JSON inválido → 400.
6. POST bem-sucedido responde em < 200ms em dev local.
7. Shutdown limpo: `Ctrl+C` fecha tudo sem erro.

## Formato obrigatório de resposta

```markdown
## Arquivos alterados
- src/app/server.ts (criado)
- src/app/routes.ts (criado)
- ...

## Checklist
- [x] Fastify boota e registra rota
- [x] ...
- [ ] (item não marcado com justificativa)

## Pendências
- ...

## Riscos
- ...
```
