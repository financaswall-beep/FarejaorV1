# 00 - Estado de Implementação da Fase 3

> **Atualizado:** 2026-04-28 (Kimi — rascunho inicial) → **2026-04-29 (Opus — estado real)**
> **Status:** Etapas A, B e C parcial concluídas. Organizadora em produção.

---

## Resumo Executivo

A Fase 3 avançou significativamente além do que o documento original registrava.

| Etapa | Status real |
|-------|------------|
| A — Documentação | ✅ Concluída (18 docs) |
| B — Migrations SQL (0013–0021) | ✅ Aplicadas em prod (2026-04-29) |
| C — TypeScript Organizadora | ✅ Implementada e em produção |
| C - TypeScript Atendente | Sprint 1 implementado; schema 0024 validado no Supabase atual (sem runtime) |
| D — Shadow Assistido | 🟡 Em andamento (Organizadora coleta fatos reais) |
| E - Atendente v1 | Nao iniciada (sem worker/LLM/envio Chatwoot) |
| F — BI | ❌ Não iniciada |

---

## 1. Documentação (CONCLUÍDA)

| Doc | Título | Status |
|-----|--------|--------|
| 01 | Visão Geral | ✅ Completo |
| 02 | Princípios Operacionais | ✅ Completo |
| 03 | Mapa de Dados | ✅ Completo |
| 04 | Blocos do Banco | ✅ Completo |
| 05 | Fact Ledger (Organizadora) | Completo e alinhado ao codigo |
| 06 | Agent State (Atendente) | ✅ Completo |
| 07 | Commerce Grafo Veicular | ✅ Completo |
| 08 | Business Intelligence | ✅ Completo |
| 09 | Skills, Router e Validadores | ✅ Completo |
| 10 | Plano de Fases | ✅ Completo |
| 11 | Perguntas Abertas | ✅ Completo |
| 12 | Context Builder e Slot Filling | ✅ Completo |
| 13 | Fluxo de Eventos e Integração | ✅ Completo |
| 14 | Topologia de Execução | ✅ Completo |
| 15 | Shadow Assisted Mode | ✅ Completo |
| 16 | Planejamento de Tabelas em Português | ✅ Completo |
| 17 | Mapa Português-Inglês | ✅ Completo |
| 18 | Diagrama ER | ✅ Completo |

> **Nota doc 05:** corrigido em 2026-04-29. A Organizadora LLM escreve
> somente em `analytics.conversation_facts`, `analytics.fact_evidence` e
> `ops.agent_incidents`. `analytics.linguistic_hints` e
> `analytics.conversation_classifications` continuam como saidas deterministicas
> da F2A, nao da Organizadora LLM atual.

---

## 2. Migrations SQL (APLICADAS EM PROD)

| Migration | Conteúdo | Status |
|-----------|----------|--------|
| 0013_commerce_layer.sql | 15 tabelas commerce.* | ✅ Aplicada em prod |
| 0014_commerce_indexes.sql | Índices pg_trgm, preço, estoque | ✅ Aplicada em prod |
| 0015_commerce_views.sql | Views current_prices, product_full, customer_profile | ✅ Aplicada em prod |
| 0016_agent_layer.sql | 8 tabelas agent.* + view pending_human_closures | ✅ Aplicada em prod |
| 0017_agent_triggers.sql | Validações cross-table, updated_at, append-only | ✅ Aplicada em prod |
| 0018_analytics_evidence.sql | fact_evidence + views current_facts/current_classifications | ✅ Aplicada em prod |
| 0019_ops_phase3_additions.sql | atendente_jobs, enrichment_jobs upgrade, unhandled_messages, agent_incidents + funções enqueue | ✅ Aplicada em prod |
| 0020_vehicle_fitment_validation.sql | find_compatible_tires, resolve_neighborhood, build_escalation_summary + agent_dashboard | ✅ Aplicada em prod (fix: `position` → `fitment_position`) |
| 0021_environment_match_guards.sql | 30+ triggers env_match cross-table | ✅ Aplicada em prod |
| 0024_atendente_v1_state_extensions.sql | Extensoes reentrantes da Atendente: version/action_id/session_items/session_slots | ✅ Schema validado no Supabase atual |

**Data de aplicação:** 2026-04-29

---

## 3. Código TypeScript — Organizadora (COMPLETA E EM PRODUÇÃO)

| Arquivo | Conteúdo | Status |
|---------|----------|--------|
| `src/shared/types/agent.ts` | Interfaces para agent.* | ✅ Escrito |
| `src/shared/types/commerce.ts` | Interfaces para commerce.* | ✅ Escrito |
| `src/shared/types/analytics-phase3.ts` | fact_evidence, current_facts | ✅ Escrito |
| `src/shared/types/ops-phase3.ts` | atendente_jobs, unhandled_messages, agent_incidents | ✅ Escrito |
| `src/shared/zod/agent-actions.ts` | Discriminated union das 8 actions | ✅ Escrito |
| `src/shared/zod/fact-keys.ts` | Schemas dos 30 fact_keys + validateFactValue() | ✅ Escrito |
| `src/shared/zod/llm-organizadora.ts` | Envelope Organizadora + parseOrganizadoraResponse() | ✅ Escrito |
| `src/shared/llm-clients/openai.ts` | Cliente OpenAI via fetch (timeout, 1 retry) | ✅ Escrito e corrigido (max_completion_tokens) |
| `src/shared/repositories/ops-phase3.repository.ts` | pickEnrichmentJob, markJobRunning/Done/Failed, logIncident | ✅ Escrito |
| `src/shared/repositories/analytics-phase3.repository.ts` | writeFactWithEvidence (fact + supersede + evidence) | ✅ Escrito |
| `src/shared/repositories/core-reader.repository.ts` | listMessagesForOrganizadora, getContactByConversationId | ✅ Escrito |
| `src/persistence/enrichment-jobs.repository.ts` | enqueueOrganizadoraJob via ops.enqueue_enrichment_job() | ✅ Escrito |
| `src/normalization/dispatcher.ts` | Enfileira job após message_created | ✅ Atualizado |
| `src/organizadora/prompt.ts` | buildOrganizadoraPrompt (system + transcrição com msg_ids) | ✅ Escrito |
| `src/organizadora/worker.ts` | Loop completo: pickup → LLM → validate → write facts → done | ✅ Escrito e corrigido (SAVEPOINT) |
| `src/organizadora/index.ts` | Entrypoint com graceful shutdown | ✅ Escrito |
| `src/shared/config/env.ts` | ORGANIZADORA_ENABLED, OPENAI_API_KEY, OPENAI_MODEL, etc. | ✅ Atualizado |
| `src/app/server.ts` | Integra startOrganizadora() no boot | ✅ Atualizado e em prod |

### Bugs corrigidos em produção (2026-04-29)

| Bug | Correção |
|-----|---------|
| `max_tokens` rejeitado pelo gpt-5.x (HTTP 400) | Alterado para `max_completion_tokens` em `openai.ts` |
| Um fato com erro SQL abortava toda a transação ("current transaction is aborted") | Adicionado SAVEPOINT por fato em `worker.ts` |

### Deploy

- **Plataforma:** Coolify (serviço `farejador-pneus`)
- **Modelo:** gpt-5.4 via OpenAI
- **Feature flag:** `ORGANIZADORA_ENABLED=true`
- **Node:** 22 (`NIXPACKS_NODE_VERSION=22`)
- **Validado:** 2026-04-29 — extração de fatos reais confirmada no Supabase

---

## 4. Codigo TypeScript - Atendente (SPRINT 1 LOCAL)

| Componente | Status |
|------------|--------|
| `src/shared/validators/` — SayValidator, ActionValidator | ❌ Não existe |
| `src/atendente/` — worker async | ❌ Não existe |
| Context Builder | ❌ Não existe |
| Skill Router | ❌ Não existe |

---

## 5. Tabelas no Banco (Estado Real)

| Schema | Tabelas | Status |
|--------|---------|--------|
| `commerce` | 15 tabelas | ✅ Existem em prod (vazias — aguardam importação de dados) |
| `agent` | 8 tabelas | ✅ Existem em prod (vazias — aguardam Atendente) |
| `analytics.fact_evidence` | 1 tabela | ✅ Existe em prod — **sendo populada pela Organizadora** |
| `analytics.conversation_facts` | 1 tabela | ✅ Existe em prod — **sendo populada pela Organizadora** |
| `ops.enrichment_jobs` | 1 tabela | ✅ Existe em prod — **fila ativa da Organizadora** |
| `ops.atendente_jobs` | 1 tabela | ✅ Existe em prod (vazia — aguarda Atendente) |
| `ops.unhandled_messages` | 1 tabela | ✅ Existe em prod (vazia — aguarda Atendente) |
| `ops.agent_incidents` | 1 tabela | ✅ Existe em prod — **incidentes da Organizadora registrados aqui** |

---

## 6. Ferramentas de Teste

| Ferramenta | Descrição | Status |
|------------|-----------|--------|
| `simulate-chatwoot.bat` | Envia webhooks assinados diretamente ao Farejador (bypassa Chatwoot) | ✅ Criado |
| `chatwoot-chat.bat` | Cria conversas reais via API do Chatwoot (aparece no painel) | ✅ Criado |

---

## 7. Teste End-to-End Validado (2026-04-29)

Pipeline completo validado com conversa real:

```
Webhook Chatwoot
  → raw.raw_events (status: processed)
  → core.messages (upserted)
  → ops.enrichment_jobs (enqueued, debounce 90s)
  → Organizadora (picked job, chamou gpt-5.4)
  → analytics.conversation_facts (facts gravados)
  → analytics.fact_evidence (evidence vinculada)
```

**Fatos extraídos em teste real:**
- `moto_modelo = "Bros"` (confidence: 93%, truth_type: observed)
- `posicao_pneu = "traseiro"` (confidence: 78%, truth_type: observed)

---

## 8. Próximos Passos

1. **Redeploy farejador-pneus** - hardening da Organizadora precisa ir para prod
2. **Teste com conversa longa** — endereço, preço, cidade para validar todos os fatos
3. **Importar dados de Commerce** — produtos, veículos, compatibilidades, preços (planilha)
4. **Shadow Assistido** — Wallace atende manualmente por 5 semanas, Organizadora coleta fatos
5. **Calibração semanal** — conferir fact_keys reais vs teóricas
6. **Iniciar Atendente** — apenas após Shadow Assistido concluído

---

## 9. Variáveis de Ambiente em Produção (Coolify)

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `ORGANIZADORA_ENABLED` | `true` | Liga a Organizadora |
| `OPENAI_API_KEY` | `sk-...` | Chave da OpenAI (rotacionar!) |
| `OPENAI_MODEL` | `gpt-5.4` | Modelo usado |
| `OPENAI_TIMEOUT_MS` | `30000` | Timeout por chamada |
| `ORGANIZADORA_POLL_INTERVAL_MS` | `5000` | Frequência de poll |
| `ORGANIZADORA_DEBOUNCE_MS` | `90000` | Debounce de enfileiramento |
| `NIXPACKS_NODE_VERSION` | `22` | Node.js versão |
| `PORT` | `3001` | Porta do servidor |

---

*Documento atualizado por Opus em 2026-04-29 para refletir estado real de implementação.*

---

## Atualizacao Codex 2026-04-29

- `0022_conversation_facts_append_ledger.sql` foi aplicada em prod em 2026-04-29.
- A Organizadora agora valida `from_message_id` e `evidence_text` literal antes de gravar fatos.
- Incidentes fatais da Organizadora passam a ser gravados fora da transacao sujeita a rollback.
- `markJobRunning` passa a ser commitado antes do processamento do job.
- Supersedencia de fatos considera `truth_type` e `confidence_level`; fato fraco nao derruba fato forte.
- Scripts locais com tokens/endpoints (`simulate-chatwoot.*`, `chatwoot-chat.*`, `audit-*.js`) foram adicionados ao `.gitignore`.

---

## Atualizacao 2026-04-29 - Sprint 1 da Atendente implementado localmente

**Status:** implementado e testado localmente. Schema da migration 0024
validado no Supabase atual. Atendente runtime ainda **nao existe**.

- Doc `21-atendente-v1-state-design.md` revisado por Opus + Codex.
- **Filosofia da revisao 2:** estender o schema de `0016_agent_layer.sql`, NAO substituir.
  As 9 tabelas de 0016 (session_current, session_events, turns, pending_confirmations, cart_current, cart_current_items, cart_events, order_drafts, escalations) ficam intactas. Plano aditivo apenas.
- Decisoes consolidadas:
  - Estado reentrante via slots (globais + items), nao state machine linear.
  - Fase do funil e DERIVADA dos slots, nunca persistida.
  - SlotValue carrega `source` em {observed, inferred, confirmed, offered_to_client, inferred_from_history, inferred_from_organizadora}.
  - Invalidacao por procedencia: inferred deleta, observed marca stale, confirmed exige reconfirmacao forte.
  - Persistencia: tabelas relacionais existentes + 2 novas (`session_items`, `session_slots`). `ConversationState` em TS e view montada pelo repositorio, nao jsonb monolitico.
  - Planner sera read-only; mutacao so via `actions` validadas pelo ActionValidator.
  - `pediu_humano` mapeia para `escalate` existente; `objecoes_levantadas` viram evento `objection_raised` em `session_events`.
  - `urgencia` e `intencao` sao `derived_signals`, nunca persistidos.
  - Sem `extras: Record<string, SlotValue>` aberto; observacoes fora da whitelist viram evento `unsupported_observation`.
  - Seed inicial limitado: nome, bairro, municipio, forma_pagamento.
  - `analytics.conversation_facts` nao sincroniza automaticamente; sync e proposta que vira action.
  - Idempotencia por `action_id` UNIQUE em `session_events`.
  - Concorrencia: lock pessimista em `session_current` + otimistic version (campo `version` novo) + coalescencia de mensagens novas.
  - Sprint 1 nao implementa LLM, Generator, Critic, tools, envio ao Chatwoot ou escrita em `commerce.orders`.
- Entregaveis implementados localmente:
  - Migration `0024_atendente_v1_state_extensions.sql`.
  - `src/shared/zod/agent-state.ts` novo.
  - `src/shared/zod/agent-actions.ts` estendido: 8 antigas mantidas + 9 novas.
  - Funcao pura `applyAction` cobrindo as 17 actions, sem relogio/RNG no caminho.
  - Regras de invalidacao em `src/atendente/state/invalidation-rules.ts`.
  - ActionValidator com whitelist v1.
  - Repositorio `agent-state.repository.ts` com transacao, idempotencia por `action_id`, persistencia de `session_items`/`session_slots` e version check.
  - 19 testes Vitest do Sprint 1.
- Validacao local:
  - `npm run typecheck` verde.
  - `npm test` verde (223/223).
  - `npm run build` verde.
- Debitos nao bloqueantes:
  - Trocar sync de slots DELETE+INSERT por UPSERT incremental.
  - Snapshot/otimizacao futura de `last_offer` se ledger ficar grande.
  - Trocar hash deterministico simples por SHA-256 antes de trafego real.
  - Refinar semantica de eventos para cart/draft actions.
  - Fortalecer ActionValidator nas fases de LLM/Generator.

**Proximo passo:** validar observabilidade por alguns ciclos da Organizadora
e abrir Sprint 2 quando Wallace quiser continuar.

---

## Atualizacao 2026-04-29 - Migration 0024 aplicada em test

**Status:** `0024_atendente_v1_state_extensions.sql` aplicada no banco apontado por
`.env.codex` com `FAREJADOR_ENV=test`.

Validacoes executadas:

- `agent.session_current` contem `version` e `turn_index`.
- `agent.session_events` contem `action_id`, `turn_index`,
  `resulting_state_version` e `emitted_by`.
- `agent.session_items` e `agent.session_slots` existem.
- Indices esperados existem: `session_events_action_idx`,
  `session_events_conv_turn_idx`, `session_items_one_active_per_conv`,
  `session_slots_unique_per_key`, `session_slots_stale_idx`.
- CHECK de `agent.session_events.event_type` aceita eventos antigos e novos:
  `skill_selected` e `unsupported_observation` foram inseridos em
  `environment=test`.
- Simulacao leve de estado reentrante em `environment=test`:
  `session_current.version=2`, 1 `session_item`, 1 `session_slot`, 2 eventos
  do fluxo Sprint 1.
- Validacao local apos aplicacao:
  - `npm run typecheck` verde.
  - `npm test` verde (223/223).
  - `npm run build` verde.

**Proximo passo:** manter em observacao e abrir Sprint 2 quando Wallace quiser
continuar.

---

## Atualizacao 2026-04-29 - Schema 0024 validado no Supabase atual

**Status:** o check estrutural de `0024_atendente_v1_state_extensions.sql`
foi executado com sucesso no banco Supabase atualmente configurado no workspace.
Como a migration altera schema, nao ha aplicacao separada por `environment`.
O runtime da Atendente continua **desligado/inexistente**.

Validacao executada:

- `tmp/check-0024.cjs` confirmou:
  - 2 colunas novas em `agent.session_current`: `version`, `turn_index`;
  - 4 colunas novas em `agent.session_events`: `action_id`, `turn_index`,
    `resulting_state_version`, `emitted_by`;
  - tabelas `agent.session_items` e `agent.session_slots` existentes;
  - CHECK de `agent.session_events.event_type` preserva os tipos antigos e
    adiciona os tipos novos do Sprint 1;
  - indices novos presentes;
  - triggers de `updated_at`, imutabilidade de `environment` e `env_match`
    presentes nas tabelas novas.

Nao foi executada simulacao em prod. A simulacao permanece restrita a
`environment=test`.

**Proximo passo:** abrir Sprint 2 com tools deterministicas
(`buscar_produto`, `verificar_estoque`, `buscar_compatibilidade`,
`calcular_frete`, `buscar_politica_comercial`) quando Wallace quiser continuar.

---

## Atualizacao 2026-04-29 - Sprint 2 tools deterministicas iniciada

**Status:** bloco inicial de tools deterministicas implementado localmente,
sem worker da Atendente, sem LLM e sem envio ao Chatwoot.

Entregaveis:

- `src/atendente/tools/commerce-tools.ts` criado com:
  - `buscarProduto`;
  - `verificarEstoque`;
  - `buscarCompatibilidade`;
  - `calcularFrete`;
  - `buscarPoliticaComercial`.
- Tools leem apenas `commerce.*` e helpers SQL ja existentes
  (`commerce.product_full`, `commerce.find_compatible_tires`,
  `commerce.resolve_neighborhood`).
- Entradas validadas por Zod.
- Saidas estruturadas para uso futuro pelo Planner/Generator.
- Nenhuma tool escreve em `core.*`, `analytics.*`, `agent.*` ou
  `commerce.orders`.
- Testes unitarios em `tests/unit/atendente/tools/commerce-tools.test.ts`.
- Testes de integracao em
  `tests/integration/atendente-commerce-tools.integration.test.ts`.
- Correcao pos-auditoria Opus:
  - `buscarProduto` exige ao menos `medida_pneu`, `marca` ou `product_code`;
  - `calcularFrete` nao aceita mais `valor_pedido` enquanto a regra de frete
    gratis por politica comercial nao estiver implementada;
  - queries de compatibilidade/frete foram validadas contra o banco real e
    aceitam os nomes atuais dos helpers SQL (`fitment_position`,
    `fitment_source`, `match_similarity`).

Validacao local:

- `npm run typecheck` verde.
- `npm test` verde (231/231).
- `npm run test:integration -- tests/integration/atendente-commerce-tools.integration.test.ts`
  verde (5/5).
- `npm run build` verde.

**Proximo passo:** revisar/auditar as tools e, depois, decidir se Sprint 2
continua com SayValidator/ActionValidator usando os resultados dessas tools ou
com um harness de smoke test em banco real de test.

---

## Atualizacao 2026-04-29 - Sprint 3 Planner foundation iniciada

**Status:** fundacao do Planner constrained implementada localmente e migration
`0025_planner_foundation.sql` aplicada/validada no Supabase atual. O runtime da
Atendente continua **desligado/inexistente**; nao ha envio Chatwoot nem
Generator.

Entregaveis:

- Migration `0025_planner_foundation.sql`:
  - adiciona `planner_decided` em `agent.session_events.event_type`;
  - adiciona `aliases text[]` em `commerce.vehicle_models`;
  - cria `commerce.resolve_vehicle_model` com match exato, alias e pg_trgm;
  - realinha helpers para nomes canonicos:
    `fitment_position`, `fitment_source`, `match_similarity`.
- `src/atendente/policies/policy-schemas.ts`:
  `POLICY_VALUE_SCHEMAS` para impedir JSON cru em politica comercial.
- `src/atendente/planner/`:
  - `schemas.ts` com `PlannerOutput`, `ToolRequest` com input completo e
    `prompt_version`;
  - `context-builder.ts` para montar `PlannerContext`;
  - `prompt.ts` versionado;
  - `service.ts` com Planner mock deterministico, fallback de schema fail e
    `recordPlannerDecision`;
  - `index.ts` exportando o modulo.
- `src/shared/config/env.ts`:
  - `PLANNER_LLM_ENABLED=false` por default;
  - `PLANNER_MODEL=gpt-4o-mini` por default.
- `buscarCompatibilidade` agora usa `commerce.resolve_vehicle_model`.
- `buscarPoliticaComercial` valida `policy_value` por chave conhecida.

Validacao executada:

- Aplicacao/validacao de `0025` no Supabase atual confirmou:
  - `planner_decided` presente no CHECK de `agent.session_events`;
  - `find_compatible_tires` retorna `fitment_position` e `fitment_source`;
  - `resolve_neighborhood` retorna `match_similarity`;
  - `resolve_vehicle_model` existe com retorno esperado.
- `npm run typecheck` verde.
- `npm test` verde (239/239).
- `npm run test:integration -- tests/integration/atendente-commerce-tools.integration.test.ts`
  verde (5/5).
- `npm run build` verde.

Fora de escopo ainda:

- Atendente worker;
- Generator;
- Critic;
- envio Chatwoot;
- Planner LLM ligado por default;
- actions automáticas a partir da decisão do Planner.

**Proximo passo:** auditoria Opus da Sprint 3 foundation antes de seguir para
worker shadow ou validadores de fala/ação.
