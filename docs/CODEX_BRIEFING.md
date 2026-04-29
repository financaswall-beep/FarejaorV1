# Briefing para o Codex — Estado atual do Farejador (2026-04-29)

Este documento é um briefing completo do que foi feito até hoje no projeto
`farejador-pneus`. Use-o como ponto de partida para qualquer tarefa nova.

---

## EM QUE FASE ESTAMOS AGORA

> **Fase 3 — Etapa D: Shadow Assistido**
>
> Data de início: 2026-04-29

O que isso significa na prática:

- A **Organizadora** (LLM que extrai fatos das conversas) está **em produção e funcionando**.
- O **Wallace atende os clientes manualmente** no Chatwoot — sem bot respondendo ainda.
- A cada conversa, a Organizadora roda em background e popula `analytics.conversation_facts` + `analytics.fact_evidence`.
- O objetivo desta etapa é **calibrar a extração de fatos com conversas reais** antes de ligar o bot.

O que NÃO está ligado ainda:
- A LLM **Atendente** (bot que responde clientes) — `ATENDENTE_ENABLED` não existe nem no código.
- Pedidos automáticos — tudo passa por confirmação humana.
- BI / Dashboard — tabelas commerce ainda estão vazias.

Critérios para sair do Shadow Assistido e iniciar a Atendente v1:
- ~5 semanas de conversas reais coletadas (~3.500 conversas)
- Taxa de `evidence_not_literal` abaixo de 5%
- Taxa de `schema_violation` zerada
- Taxonomia de classifications estável
- Decisão final do Wallace

---

## O que é o projeto

Sistema backend em TypeScript que:
1. **Recebe webhooks** do Chatwoot (plataforma de atendimento)
2. **Normaliza** os dados em tabelas estruturadas (Supabase/PostgreSQL)
3. **Extrai fatos** das conversas com LLM (OpenAI gpt-5.4) via "Organizadora"
4. **Futuramente** — vai ter uma LLM "Atendente" que responde clientes automaticamente

**Dono:** Wallace — loja de pneus de moto no Rio de Janeiro
**Stack:** TypeScript, Node.js 22, Fastify, Zod, pg, Pino, Vitest
**Banco:** Supabase (PostgreSQL) via Connection Pooler
**Deploy:** Coolify — serviço `farejador-pneus`
**Repositório local:** `C:\Farejador agente`

---

## Estado das fases

| Fase | Descrição | Status |
|------|-----------|--------|
| Fase 1 | Webhook + normalização determinística + admin endpoints | ✅ Completa e em prod |
| Fase 1.5 | Hardening — triggers de imutabilidade, constraints de dedup, reconcile | ✅ Completa e em prod |
| Fase 2a | Enrichment determinístico (sinais + classificações) | ✅ Completa |
| Fase 3 — Etapa A | Documentação de arquitetura (18 docs) | ✅ Completa |
| Fase 3 — Etapa B | Migrations SQL 0013–0021 | ✅ Aplicadas em prod (2026-04-29) |
| Fase 3 — Etapa C | Código TypeScript da Organizadora | ✅ Em produção (2026-04-29) |
| Fase 3 — Etapa D | Shadow Assistido (Wallace atende, Organizadora coleta) | 🟡 Em andamento |
| Fase 3 — Etapa E | Atendente v1 | ❌ Não iniciada |
| Fase 3 — Etapa F | BI / Dashboard | ❌ Não iniciada |

---

## Schemas do banco

```
raw.*         → entrada bruta dos webhooks (IMUTÁVEL após gravação)
core.*        → dados normalizados: contacts, conversations, messages, attachments, etc.
analytics.*   → fatos extraídos por LLM, sinais, classificações
commerce.*    → catálogo da loja: produtos, preços, estoque, veículos, compatibilidades
agent.*       → estado do agente conversacional: sessões, turnos, carrinho, pedidos
ops.*         → filas, incidentes, logs operacionais
```

**Invariante sagrada:** Organizadora NUNCA escreve em `raw.*` ou `core.*`.

---

## O que a LLM Organizadora faz

- Consome jobs da fila `ops.enrichment_jobs` (FOR UPDATE SKIP LOCKED)
- Busca mensagens da conversa em `core.messages`
- Monta prompt com a transcrição completa
- Chama OpenAI (gpt-5.4) com `response_format: json_object`
- Valida resposta com Zod (`parseOrganizadoraResponse`)
- Para cada fato extraído:
  - Verifica confidence mínima (0.55)
  - Valida o valor contra o schema da chave (`validateFactValue`)
  - Grava em `analytics.conversation_facts` (SAVEPOINT por fato)
  - Grava evidência em `analytics.fact_evidence`
  - Se fato já existia para a mesma chave/conversa, supersede o anterior
- Marca o job como done (ou failed)
- Erros estruturais viram `ops.agent_incidents`

**Feature flag:** `ORGANIZADORA_ENABLED=true` no Coolify
**Modelo:** `gpt-5.4` (usa `max_completion_tokens`, NÃO `max_tokens`)
**Debounce:** 90 segundos após última mensagem

---

## Fact keys disponíveis (whitelist)

```
moto_marca, moto_modelo, moto_ano, moto_cilindrada, moto_uso
medida_pneu, posicao_pneu, marca_pneu_preferida, marca_pneu_recusada, quantidade_pneus
intencao_cliente, motivo_compra, urgencia
preferencia_principal, faixa_preco_desejada, aceita_alternativa
bairro_mencionado, municipio_mencionado, modalidade_entrega, perguntou_entrega_hoje
forma_pagamento
pediu_desconto, perguntou_parcelamento, achou_caro
concorrente_citado, preco_concorrente
produto_oferecido, produto_aceito, produto_recusado_motivo
pediu_humano
nome_cliente
```

Definidas em `src/shared/zod/fact-keys.ts`.

---

## Arquivos principais

### Organizadora (implementada e em prod)
```
src/organizadora/worker.ts          → loop principal: poll → LLM → validate → write
src/organizadora/prompt.ts          → buildOrganizadoraPrompt() + SCHEMA_VERSION
src/organizadora/index.ts           → entrypoint com graceful shutdown
src/shared/llm-clients/openai.ts    → callOpenAI() — usa max_completion_tokens
src/shared/zod/llm-organizadora.ts  → parseOrganizadoraResponse()
src/shared/zod/fact-keys.ts         → validateFactValue() + schemas dos 30 fact_keys
src/shared/repositories/
  analytics-phase3.repository.ts    → writeFactWithEvidence()
  ops-phase3.repository.ts          → pickEnrichmentJob, markJobDone/Failed, logIncident
  core-reader.repository.ts         → listMessagesForOrganizadora, getContactByConversationId
src/persistence/
  enrichment-jobs.repository.ts     → enqueueOrganizadoraJob()
src/app/server.ts                   → startOrganizadora() no boot, stopOrganizadora() no shutdown
src/shared/config/env.ts            → todas as variáveis de ambiente
```

### Fase 1 / Normalização (em prod desde antes)
```
src/webhook/handler.ts              → POST /webhooks/chatwoot + HMAC
src/normalization/worker.ts         → loop de normalização (FOR UPDATE SKIP LOCKED)
src/normalization/dispatcher.ts     → por event_type → mapper + enqueueOrganizadoraJob
src/normalization/mappers/          → contact, conversation, message, attachment, etc.
src/admin/                          → /healthz, /admin/replay, /admin/reconcile
```

### Banco / Migrations
```
db/migrations/0001_init_schemas.sql          → schemas raw, core, analytics, ops
db/migrations/0002_raw_layer.sql             → raw_events, delivery_seen
db/migrations/0003_core_layer.sql            → contacts, conversations, messages, etc.
db/migrations/0004_analytics_layer.sql       → sinais, classificações, fatos
db/migrations/0005_ops_layer.sql             → filas básicas
db/migrations/0006_concurrency_guards.sql    → guards de concorrência
db/migrations/0007_raw_immutability.sql      → trigger de imutabilidade raw
db/migrations/0008_dedup_constraints.sql     → UNIQUE de status_events e assignments
db/migrations/0009_...                        → (ver README da pasta)
db/migrations/0013_commerce_layer.sql        → 15 tabelas commerce.*
db/migrations/0014_commerce_indexes.sql      → índices
db/migrations/0015_commerce_views.sql        → views commerce
db/migrations/0016_agent_layer.sql           → 8 tabelas agent.*
db/migrations/0017_agent_triggers.sql        → triggers agent
db/migrations/0018_analytics_evidence.sql    → fact_evidence + views current_facts
db/migrations/0019_ops_phase3_additions.sql  → atendente_jobs, enrichment_jobs, incidentes
db/migrations/0020_vehicle_fitment_validation.sql → funções auxiliares
db/migrations/0021_environment_match_guards.sql   → 30+ triggers env_match
```

Todas as migrations de 0001 a 0021 estão aplicadas em prod.

---

## Bugs já corrigidos (não corrigir de novo)

### 1. `max_tokens` → `max_completion_tokens`
**Arquivo:** `src/shared/llm-clients/openai.ts`
**Problema:** gpt-5.x retorna HTTP 400 se receber `max_tokens`
**Fix:** trocar por `max_completion_tokens` no body JSON
**Commit:** `064c9cb`

### 2. SAVEPOINT por fato
**Arquivo:** `src/organizadora/worker.ts`
**Problema:** Um erro SQL em um fato abortava a transação inteira. Todos os fatos
seguintes falhavam com "current transaction is aborted".
**Fix:** Cada fato é envolvido em SAVEPOINT/RELEASE/ROLLBACK TO SAVEPOINT
**Commit:** `851fdd5`

### 3. `position` palavra reservada em migration 0020
**Arquivo:** `db/migrations/0020_vehicle_fitment_validation.sql`
**Problema:** `position` é palavra reservada no PostgreSQL
**Fix:** Renomeado para `fitment_position` e `fitment_source`

---

## Variáveis de ambiente (Coolify — farejador-pneus)

```env
FAREJADOR_ENV=prod
DATABASE_URL=postgresql://...              # connection pooler Supabase
CHATWOOT_WEBHOOK_SECRET=...
ADMIN_TOKEN=...
PORT=3001
NODE_ENV=production
NIXPACKS_NODE_VERSION=22

# Organizadora
ORGANIZADORA_ENABLED=true
OPENAI_API_KEY=sk-...                     # ⚠️ Rotacionar — foi exposta no chat
OPENAI_MODEL=gpt-5.4
OPENAI_TIMEOUT_MS=30000
ORGANIZADORA_POLL_INTERVAL_MS=5000
ORGANIZADORA_DEBOUNCE_MS=90000
```

---

## Invariantes que NUNCA devem ser violadas

1. `raw.raw_events` é imutável — trigger no banco bloqueia UPDATE/DELETE
2. Organizadora NUNCA escreve em `raw.*` ou `core.*`
3. Atendente (quando existir) NUNCA escreve em `raw.*` ou `core.*` ou `commerce.*`
4. `analytics.conversation_facts` nunca tem UPDATE de valor — mudança = nova linha + superseded_by
5. Todo fato LLM precisa de evidência em `fact_evidence`
6. `environment` (prod/test) nunca se mistura — 30+ triggers garantem isso no banco

---

## O que ainda NÃO existe

- `src/atendente/` — worker da LLM Atendente
- `src/shared/validators/` — SayValidator, ActionValidator
- Context Builder (lê fatos + commerce → monta contexto para Atendente)
- Skill Router
- Importação de dados de Commerce (produtos, veículos, preços, estoque)
- Dashboard / BI

---

## Ferramentas de teste disponíveis

| Ferramenta | O que faz |
|-----------|-----------|
| `simulate-chatwoot.bat` | Envia webhooks assinados direto ao Farejador (localhost ou prod). Útil para testar sem Chatwoot. |
| `chatwoot-chat.bat` | Cria conversas reais via API do Chatwoot. O webhook dispara automaticamente pro Farejador. |

---

## Documentação relevante

```
docs/CHECKLIST.md                                    → checklist master de tudo
docs/DATA_DICTIONARY.md                              → dicionário de todas as tabelas
docs/phase3-agent-architecture/00-estado-de-implementacao.md → estado atual (atualizado)
docs/phase3-agent-architecture/05-fact-ledger-organizadora.md -> atualizado: Organizadora LLM escreve facts/evidence; hints/classifications sao F2A
docs/phase3-agent-architecture/16-planejamento-tabelas-em-portugues.md → todas as tabelas em português simples
docs/adr/ADR-004-fase-3-arquitetura-agente.md        → decisões de arquitetura da Fase 3
segments/moto-pneus/extraction-schema.json           → schema de extração do segmento
```

---

## Próximas tarefas prioritárias

1. **Redeploy farejador-pneus** para pegar hardening da Organizadora (evidencia literal, incidentes persistentes, supersedencia segura)
2. **Teste com conversa longa** (endereço + preço + cidade) para validar todos os fatos salvos
3. **Importar dados de Commerce** via planilha — sem dados de produtos/preços/estoque, a Atendente futura não funciona
4. **Shadow Assistido** — Wallace atende manualmente por ~5 semanas, Organizadora coleta fatos reais
5. **Deletar serviço farejaor-v1** no Coolify (duplicata não usada)
6. **Rotacionar OPENAI_API_KEY** — foi exposta em chat

---

*Gerado por Opus em 2026-04-29*

---

## Atualizacao Codex 2026-04-29 - hardening Organizadora

- `0022_conversation_facts_append_ledger.sql` aplicada em Supabase prod em 2026-04-29.
- Organizadora valida `from_message_id` contra mensagens da conversa e exige `evidence_text` literal antes de gravar facts.
- Incidentes fatais (`llm_timeout`, `llm_api_error`, resposta invalida) sao gravados fora da transacao sujeita a rollback.
- `markJobRunning` e commitado antes do processamento para o job nao ficar eternamente `pending` se o worker morrer durante a chamada LLM.
- Supersedencia de facts considera `truth_type` e `confidence_level`; fato fraco entra no ledger ja superseded pelo fato forte ativo.
- `simulate-chatwoot.*`, `chatwoot-chat.*` e `audit-*.js` estao no `.gitignore` por conterem dados locais sensiveis.
