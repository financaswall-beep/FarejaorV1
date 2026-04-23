# F1-03 — Endpoints admin (health, replay, reconcile)

## Objetivo
Expor três endpoints administrativos protegidos por bearer token: saúde, replay de
raw event específico, e reconciliação via API do Chatwoot para preencher lacunas.

## Escopo

**Inclui:**
- `GET /healthz` — liveness + readiness (checa DB)
- `POST /admin/replay/:raw_event_id` — força reprocessamento de um raw_event
- `POST /admin/reconcile` — puxa conversas via API Chatwoot em janela de datas e
  injeta como raw_events sintéticos (com `chatwoot_delivery_id` prefixado `reconcile:`)
- Middleware de auth bearer em `src/admin/auth.ts`

**Não inclui:**
- Escrita em `analytics.*`
- UI / dashboard
- Autenticação sofisticada (OAuth, JWT). Bearer simples já basta.
- Rate limiting avançado (Fastify default é suficiente)

## Arquivos que pode criar/editar

- `src/admin/auth.ts`
- `src/admin/health.route.ts`
- `src/admin/replay.route.ts`
- `src/admin/replay.service.ts`
- `src/admin/reconcile.route.ts`
- `src/admin/reconcile.service.ts`
- `src/admin/chatwoot-api.client.ts`
- `src/app/routes.ts` (registrar as rotas novas)

## Arquivos que NÃO deve mexer

- `src/shared/types/chatwoot.ts`
- `db/migrations/**`
- `src/webhooks/**`
- `src/normalization/**`
- `src/persistence/raw-events.repository.ts` (use a função existente; não reescreva)
- `package.json` (exceção: `undici` ou `node:fetch` nativo — se precisar lib HTTP
  nova, pare e pergunte)

## Regras específicas

1. **Todo endpoint `/admin/*` exige** header `Authorization: Bearer <ADMIN_AUTH_TOKEN>`.
   Falta ou mismatch → 401.
2. **Comparação de token timing-safe** (`crypto.timingSafeEqual`).
3. **`GET /healthz` não precisa de auth.** Responde 200 se DB respondeu `SELECT 1`
   em até 500ms, senão 503.
4. **Replay**: dado um `raw_event_id`, marca a linha `pending`, zera `processing_error`
   e `processed_at`. O worker da F1-02 vai pegar no próximo tick.
5. **Reconcile**: recebe body `{ since: ISO, until: ISO, environment: 'prod' | 'test' }`.
   Chama `GET /api/v1/accounts/:id/conversations` paginando, e para cada conversa +
   suas mensagens, injeta em `raw.raw_events` como se fosse webhook — com
   `chatwoot_delivery_id = 'reconcile:' + conversation_id + ':' + message_id` para
   garantir idempotência via bouncer.
6. **Reconcile é síncrono mas streaming**: responde 200 ao final com contagens
   `{ inserted: N, skipped_duplicate: M, errors: K }`. Se operação demora mais de
   60s, aceitar — é admin, não é hot path. Log de progresso a cada 100 conversas.
7. **Nunca** reconcile escreve em `core.*` direto. Só injeta em `raw.raw_events`.
   Normalização continua sendo responsabilidade do worker F1-02.
8. **Logs**: todo admin action loga com `actor='admin'`, request_id, resultado.

## Checklist

- [ ] Middleware de auth bearer implementado com timing-safe compare
- [ ] `GET /healthz` retorna 200 quando DB saudável
- [ ] `GET /healthz` retorna 503 quando DB não responde
- [ ] `POST /admin/replay/:id` marca pending + limpa campos de erro
- [ ] Replay de id inexistente retorna 404
- [ ] Replay de id já pending retorna 200 sem mudança
- [ ] `POST /admin/reconcile` valida body com Zod
- [ ] Reconcile chama Chatwoot API com paginação
- [ ] Reconcile injeta via `raw.delivery_seen` (dedup funciona)
- [ ] Reconcile responde com contagens
- [ ] Todos os admin endpoints protegidos por bearer
- [ ] Endpoint sem bearer retorna 401

## Critérios de aceite

1. `curl /healthz` → 200 `{ "status": "ok" }`.
2. `curl -X POST /admin/replay/123` sem token → 401.
3. `curl -H "Authorization: Bearer $TOKEN" -X POST /admin/replay/123` com id existente
   → raw_event marcado pending.
4. Mesmo chamado com id inexistente → 404.
5. `POST /admin/reconcile` com janela de 1 dia → traz conversas; re-executar a mesma
   janela não gera duplicatas (bouncer funciona).
6. Durante reconcile, `raw.raw_events.chatwoot_delivery_id` tem prefixo `reconcile:`.

## Formato obrigatório de resposta

Mesmo formato de F1-01 (arquivos / checklist / pendências / riscos).
