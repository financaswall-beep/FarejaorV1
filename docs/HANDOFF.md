# Relatório de contexto — Projeto Farejador
**Data**: 23/04/2026 | **Para**: Claude Code / GPT (nova sessão)

---

## O que é o projeto

**Farejador** — sistema de captura determinística de conversas do Chatwoot (WhatsApp, Instagram, Facebook via Meta) para Supabase Postgres. O dono opera uma loja de pneus no Rio de Janeiro, usa Chatwoot self-hosted no Coolify.

**Objetivo**: construir base de dados estruturada para analytics de negócio e, no futuro, agente conversacional LLM. O Farejador em si **não é** o agente — é a fundação.

---

## Stack decidida

- TypeScript + Node.js 20
- Fastify (HTTP)
- Zod (validação)
- Supabase Postgres — projeto `aoqtgwzeyznycuakrdhp` (região sa-east-1)
- Driver `pg` direto (não o Supabase SDK)
- Pino (logging JSON)
- Vitest (testes)

---

## Arquitetura em 3 fases

| Fase | Nome | Status |
|------|------|--------|
| 1 | Farejador determinístico | **Em execução agora** |
| 2a | Enrichment determinístico (SQL/regex) | Futuro |
| 2b | Enrichment com LLM (só escreve em `analytics.*`) | Futuro |
| 3 | Agente atendente (serviço separado, read-only) | Futuro |

---

## Invariantes inegociáveis

- `environment` obrigatório em toda tabela (`prod` / `test`)
- `raw.raw_events` imutável após insert
- Dedup obrigatório via `raw.delivery_seen` antes de gravar raw
- Watermark `last_event_at` em `core.*` — evento antigo não sobrescreve novo
- **LLM nunca escreve em `raw.*` ou `core.*`** — só em `analytics.*`
- Dados observados (`core.*`) e inferidos (`analytics.*`) nunca se misturam
- Proveniência (`source`, `extractor_version`, `confidence_level`, `truth_type`) só em `analytics.*`

---

## O que já existe no repositório

**Localização**: `C:\Farejador agente\`

### Schema do banco — 6 migrations prontas (não aplicadas ainda no Supabase)

```
db/migrations/
  0001_init_schemas.sql       — extensions, schemas raw/core/analytics/ops, domínio env_t
  0002_raw_layer.sql          — raw.raw_events particionada por mês
  0003_core_layer.sql         — contacts, conversations, messages (particionada),
                                attachments, tags, status_events, assignments, reactions
  0004_analytics_layer.sql    — conversation_facts (EAV+proveniência), signals,
                                classifications, customer_journey, linguistic_hints
  0005_ops_layer.sql          — stock_snapshots, enrichment_jobs, bot_events,
                                erasure_log, ops.anonymize_contact()
  0006_concurrency_guards.sql — raw.delivery_seen (bouncer dedup), last_event_at +
                                trigger skip_stale_update em core.*,
                                ops.ensure_monthly_partitions()
  README.md                   — convenções, fases de população, regras de concorrência
```

### Documentação de controle

```
docs/
  PROJECT.md               — visão geral em 1 página
  KIMI_RULES.md            — regras obrigatórias do executor (Kimi K2)
  CONTRACTS.md             — regras dos tipos compartilhados
  CONFIG.md                — inventário de env vars
  LOGGING.md               — padrão pino JSON, proibições de PII
  REVIEW_PROTOCOL.md       — fluxo branch → diff → revisão → merge
  HANDOFF.md               — este arquivo
  adr/
    ADR-001-core-vs-analytics.md   — LLM nunca toca raw/core
    ADR-002-deterministic-mvp.md   — Fase 1 zero LLM
    ADR-003-no-premature-files.md  — sem arquivos especulativos
  phases/
    PHASE_01.md            — escopo, entregáveis, critérios de aceite da Fase 1
  tasks/
    F1-01-webhook.md       — task do webhook end-to-end
    F1-02-normalization.md — task do worker de normalização
    F1-03-admin.md         — task dos endpoints admin
    F1-04-tests.md         — task de fixtures + infraestrutura de testes
```

### Stubs de código (pré-existentes antes do Kimi começar)

```
src/shared/types/chatwoot.ts  — schemas Zod completos dos payloads do Chatwoot
                                 (environmentSchema, chatwootEventTypeSchema,
                                  chatwootContactSchema, chatwootConversationSchema,
                                  chatwootMessageSchema, chatwootAttachmentSchema,
                                  chatwootWebhookEnvelopeSchema,
                                  chatwootWebhookHeadersSchema)
package.json                  — dependências corretas (fastify, zod, pg, pino /
                                 vitest, tsx, ts)
tsconfig.json                 — strict mode, NodeNext, ES2022
.env.example                  — todas as env vars com placeholders
.gitignore                    — node_modules, .env*, dist
AGENTS.md                     — guia operacional para agentes de IA no repo
```

---

## O que o executor (Kimi K2) já fez

### F1-04 — Fixtures + infraestrutura de testes ✅ APROVADA E MERGEADA

Entregou:
- `vitest.config.ts` com alias `@` → `src`
- 8 fixtures JSON sintéticas em `tests/fixtures/chatwoot/` (7 event types do MVP + 1 mensagem com attachment)
- `tests/helpers/hmac.ts` — gera HMAC-SHA256 via `node:crypto`
- `tests/helpers/db.ts` — esqueleto setup/teardown (conexão real vai em F1-01/F1-02)
- `tests/unit/shared/types/chatwoot.test.ts` — 9 testes (8 positivos + 1 negativo)
- `tests/unit/webhooks/chatwoot.handler.test.ts` — fluxo do handler com `pg` mockado
- `tests/unit/webhooks/chatwoot.hmac.test.ts` — HMAC e timestamp
- `tests/README.md`

Resultado atual: `npm test` → **21/21 verde**.

**Problema encontrado e corrigido**: `@fastify/raw-body@^5.0.0` não existe no npm.
Removido do `package.json`. Raw body capturado via `addContentTypeParser` nativo
do Fastify (documentado em F1-01).

---

## Estado atual: F1-01 implementada localmente

F1-01 foi integrada ao workspace atual a partir da branch `feature/F1-01-webhook`,
com ajustes de revisão.

**Entregue**:
- Boot Fastify em `src/app/server.ts`
- Rota `POST /webhooks/chatwoot`
- Validação HMAC (`X-Chatwoot-Signature`) com timing-safe compare
- Rejeição de timestamp expirado (`X-Chatwoot-Timestamp` > 300s)
- Dedup via `raw.delivery_seen` e insert em `raw.raw_events` no mesmo CTE
- Insert em `raw.raw_events` com `processing_status='pending'`
- Resposta 2xx rápida (normalização é async, feita em F1-02)
- Pool `pg` em `src/persistence/db.ts`
- SSL explícito no pool `pg` quando `DATABASE_SSL=true` ou a URL é Supabase
- Env vars validadas com Zod em `src/shared/config/env.ts`
- Logger pino em `src/shared/logger.ts`
- Testes do handler em `tests/unit/webhooks/chatwoot.handler.test.ts`
- Testes de HMAC/timestamp em `tests/unit/webhooks/chatwoot.hmac.test.ts`
- Shutdown gracioso (SIGTERM)

**Validação end-to-end executada**:
- POST com HMAC válido gravou `raw.delivery_seen` e `raw.raw_events` com `processing_status='pending'`.
- Retry com o mesmo `X-Chatwoot-Delivery` retornou 200 sem duplicar raw event.
- Assinatura inválida retornou 401 e não gravou em `raw.delivery_seen` nem `raw.raw_events`.
- Delivery sintético usado: `codex-e2e-*`.

**Ponto técnico importante — raw body para HMAC**:
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
Sem pacote externo. `addContentTypeParser` é nativo do Fastify.

---

## Fluxo de trabalho estabelecido

```
1. Dono manda task pro Kimi
2. Kimi trabalha em branch feature/F1-XX-<slug>
3. Kimi entrega: git diff + formato obrigatório
4. Dono traz pra Claude/GPT revisar
5. Revisor aprova ou pede ajuste com instrução específica
6. Dono manda ajuste pro Kimi ou faz merge
```

**Prompt padrão para mandar task ao Kimi**:
```
Leia e obedeça docs/KIMI_RULES.md.

Leia também antes de começar:
- docs/PROJECT.md
- docs/CONTRACTS.md
- docs/CONFIG.md
- docs/LOGGING.md
- docs/tasks/F1-0X-<nome>.md

Sua tarefa é exclusivamente:
docs/tasks/F1-0X-<nome>.md

Regras operacionais:
- Branch: feature/F1-0X-<slug>
- Não altere migrations em db/migrations/
- Não altere src/shared/types/chatwoot.ts (apenas importe)
- Não adicione dependências novas em package.json sem autorização

Ao final entregue:
1. git diff main...feature/F1-0X-<slug>
2. Resposta no formato obrigatório
```

---

## Checklist de review (para Claude/GPT ao revisar entrega do Kimi)

- [ ] Apenas arquivos listados na task foram alterados
- [ ] Nenhuma migration foi modificada
- [ ] `src/shared/types/chatwoot.ts` não foi alterado
- [ ] `package.json` sem dependência nova não autorizada
- [ ] Resposta no formato obrigatório (arquivos / checklist / pendências / riscos)
- [ ] Checklist 100% ou itens abertos com justificativa aceita
- [ ] Sem `any` injustificado
- [ ] Sem abstração especulativa (arquivo sem segundo caller real)
- [ ] Sem log de PII ou secrets
- [ ] Side effects isolados nos repositories

---

## Pendências abertas

1. **Migrations não aplicadas no Supabase** (`aoqtgwzeyznycuakrdhp`). Precisam ser
   aplicadas antes dos testes de integração de F1-01 e F1-02. Claude tem acesso via
   MCP ao projeto — decisão de aplicar via MCP ou manual ainda pendente.

2. **Fixture `message_with_attachment.json`** — criada após revisão para fechar o escopo da F1-04.
