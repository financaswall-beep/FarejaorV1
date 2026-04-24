# F1-03 - Endpoints admin (health, replay, reconcile)

## Status

Proxima fase. Pode iniciar agora que F1-02 esta concluida e validada.

## Objetivo

Expor endpoints administrativos protegidos por bearer token para saude, replay de
raw event especifico e reconciliacao via API do Chatwoot para preencher lacunas.

## Escopo

Inclui:

- `GET /healthz` - liveness + readiness com check de DB.
- `POST /admin/replay/:raw_event_id` - forca reprocessamento de um raw_event.
- `POST /admin/reconcile` - busca conversas via API Chatwoot em janela de datas e injeta raw_events sinteticos.
- Middleware de auth bearer em `src/admin/auth.ts`.
- Testes unitarios e, quando possivel, teste de integracao controlado contra Supabase.

Nao inclui:

- Escrita direta em `core.*` pelo admin.
- Escrita em `analytics.*`.
- UI/dashboard.
- OAuth/JWT.
- LLM.

## Arquivos permitidos

- `src/admin/auth.ts`
- `src/admin/health.route.ts`
- `src/admin/replay.route.ts`
- `src/admin/replay.service.ts`
- `src/admin/reconcile.route.ts`
- `src/admin/reconcile.service.ts`
- `src/admin/chatwoot-api.client.ts`
- `src/app/routes.ts`
- testes em `tests/unit/admin/*` e `tests/integration/*` se necessario
- documentacao desta task, caso algum criterio precise ser refinado

## Arquivos que nao deve mexer

- `src/shared/types/chatwoot.ts`
- `db/migrations/**`
- `src/webhooks/**`
- `src/normalization/**`
- `src/persistence/raw-events.repository.ts` sem necessidade real
- `package.json` sem autorizacao explicita

## Regras especificas

1. Todo endpoint `/admin/*` exige `Authorization: Bearer <ADMIN_AUTH_TOKEN>`.
2. Comparacao do token deve ser timing-safe.
3. `GET /healthz` nao exige auth.
4. Health retorna 200 se `SELECT 1` responder rapidamente; caso contrario 503.
5. Replay marca o raw_event como `pending`, limpa `processing_error` e `processed_at`.
6. Replay nao altera `payload`, `chatwoot_delivery_id`, `received_at` ou qualquer campo imutavel.
7. Reconcile injeta somente em `raw.raw_events`/`raw.delivery_seen`; normalizacao continua com o worker da F1-02.
8. Delivery sintetico de reconcile deve ter prefixo estavel `reconcile:`.
9. Logs de admin devem incluir `actor='admin'`, request id quando disponivel e resultado.
10. Nao logar secrets, token admin, HMAC secret, payload bruto ou PII desnecessaria.

## Casos que precisam de atencao por causa da auditoria F1-02

- Replay do mesmo raw_event duas vezes deve ser idempotente no `core.*`.
- Replay de status event nao pode duplicar `core.conversation_status_events`.
- Replay de assignment nao pode duplicar `core.conversation_assignments`.
- `message_created` antes de `conversation_created` deve continuar processando por causa do stub de conversa.
- Attachment deve usar o UUID de conversa retornado por `upsertMessage`, sem lookup fragil.
- Se `reactions` vierem no payload, enquanto o mapper for placeholder deve existir `logger.warn`.

## Checklist

- [ ] Middleware de auth bearer implementado com timing-safe compare.
- [ ] `GET /healthz` retorna 200 quando DB esta saudavel.
- [ ] `GET /healthz` retorna 503 quando DB nao responde.
- [ ] `POST /admin/replay/:id` marca pending e limpa campos de erro.
- [ ] Replay de id inexistente retorna 404.
- [ ] Replay de id ja pending retorna 200 sem mudanca destrutiva.
- [ ] `POST /admin/reconcile` valida body com Zod.
- [ ] Reconcile pagina Chatwoot API.
- [ ] Reconcile injeta via bouncer de dedup.
- [ ] Reconcile responde contagens `{ inserted, skipped_duplicate, errors }`.
- [ ] Todos os admin endpoints protegidos por bearer, exceto `/healthz`.
- [ ] Endpoint admin sem bearer retorna 401.
- [ ] Suite completa verde.

## Criterios de aceite

1. `GET /healthz` -> 200 `{ "status": "ok" }` quando DB responde.
2. `POST /admin/replay/:id` sem token -> 401.
3. `POST /admin/replay/:id` com token valido e id existente -> raw_event volta para `pending`.
4. Mesmo replay com id inexistente -> 404.
5. Replay de raw_event ja processado nao cria duplicatas em `core.*`.
6. `POST /admin/reconcile` com janela pequena injeta raw_events sinteticos.
7. Rodar a mesma janela de reconcile duas vezes nao duplica por causa de `raw.delivery_seen`.
8. `raw.raw_events.chatwoot_delivery_id` de reconcile usa prefixo `reconcile:`.
9. Nenhuma rota admin escreve diretamente em `core.*` ou `analytics.*`.

## Formato obrigatorio de resposta

Arquivos alterados, checklist, validacao executada, pendencias e riscos.
