# F1-03 - Endpoints admin (health, replay, reconcile)

## Status

Concluida no codigo local. F1-03 foi dividida em duas partes:

- Parte A: auth, healthz e replay.
- Parte B: reconcile via API Chatwoot.

Validacao local final:

```text
npm run typecheck  -> verde
npm test           -> 112 testes passando na suite completa atual
npm run build      -> verde
```

## Objetivo

Expor endpoints administrativos protegidos por bearer token para saude, replay de
raw event especifico e reconciliacao via API do Chatwoot para preencher lacunas.

## Escopo

Inclui:

- `GET /healthz` - liveness + readiness com check de DB.
- `POST /admin/replay/:raw_event_id` - forca reprocessamento de um raw_event.
- `POST /admin/reconcile` - busca conversas via API Chatwoot em janela de datas e injeta raw_events sinteticos.
- Middleware de auth bearer em `src/admin/auth.ts`.
- Testes unitarios.

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
8. Delivery sintetico de reconcile deve ter prefixo estavel `reconcile-v2:` e incluir `account_id`.
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

- [x] Middleware de auth bearer implementado com timing-safe compare.
- [x] `GET /healthz` retorna 200 quando DB esta saudavel.
- [x] `GET /healthz` retorna 503 quando DB nao responde.
- [x] `POST /admin/replay/:id` marca pending e limpa campos de erro.
- [x] Replay usa `FOR UPDATE` para capturar `previous_status` de forma segura.
- [x] Replay de id inexistente retorna 404.
- [x] Replay de id ja pending retorna 200 sem mudanca destrutiva.
- [x] `POST /admin/reconcile` valida body com Zod.
- [x] Reconcile limita janela a 7 dias.
- [x] Reconcile pagina Chatwoot API.
- [x] Reconcile injeta via bouncer de dedup.
- [x] Reconcile usa delivery_id deterministico `reconcile-v2:tipo:env:account_id:id:ts`.
- [x] Reconcile responde contagens `{ inserted, skipped_duplicate, errors, pages_fetched, aborted, abort_reason }`.
- [x] Reconcile retorna resultado parcial quando a paginacao de conversas falha.
- [x] Falha ao paginar mensagens de uma conversa vira erro daquela conversa e nao aborta as demais.
- [x] Todos os admin endpoints protegidos por bearer, exceto `/healthz`.
- [x] Endpoint admin sem bearer retorna 401.
- [x] Suite completa verde.

## Observacoes de implementacao

- `src/persistence/raw-events.repository.ts` recebeu ajuste minimo para aceitar `environment` explicito no input. Isso permite reconcile controlado para `prod` ou `test`.
- Erros da API Chatwoot em reconcile retornam 502 (`chatwoot_api_unavailable`).
- Falhas durante a paginacao de conversas retornam resultado parcial com `aborted=true`.
- Falhas durante a paginacao de mensagens ficam registradas em `errors` e o reconcile continua nas demais conversas.
- Reconcile nao escreve direto em `core.*`; ele injeta em `raw.*` e deixa o worker F1-02 normalizar.
- Teste manual com Chatwoot real foi executado no shadow mode: webhook, replay e reconcile foram validados contra Chatwoot/Supabase reais. O que ainda falta e automatizar parte disso em harness de integracao.

## Criterios de aceite

1. `GET /healthz` -> 200 `{ "status": "ok" }` quando DB responde.
2. `POST /admin/replay/:id` sem token -> 401.
3. `POST /admin/replay/:id` com token valido e id existente -> raw_event volta para `pending`.
4. Mesmo replay com id inexistente -> 404.
5. Replay de raw_event ja processado nao cria duplicatas em `core.*`.
6. `POST /admin/reconcile` com janela pequena injeta raw_events sinteticos.
7. Rodar a mesma janela de reconcile duas vezes nao duplica por causa de `raw.delivery_seen`.
8. `raw.raw_events.chatwoot_delivery_id` de reconcile usa prefixo `reconcile-v2:` e inclui `account_id`.
9. Nenhuma rota admin escreve diretamente em `core.*` ou `analytics.*`.

## Formato obrigatorio de resposta

Arquivos alterados, checklist, validacao executada, pendencias e riscos.
