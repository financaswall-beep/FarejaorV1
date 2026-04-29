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
| C — TypeScript Atendente | ❌ Não iniciada |
| D — Shadow Assistido | 🟡 Em andamento (Organizadora coleta fatos reais) |
| E — Atendente v1 | ❌ Não iniciada |
| F — BI | ❌ Não iniciada |

---

## 1. Documentação (CONCLUÍDA)

| Doc | Título | Status |
|-----|--------|--------|
| 01 | Visão Geral | ✅ Completo |
| 02 | Princípios Operacionais | ✅ Completo |
| 03 | Mapa de Dados | ✅ Completo |
| 04 | Blocos do Banco | ✅ Completo |
| 05 | Fact Ledger (Organizadora) | ✅ Completo — ⚠️ ver nota abaixo |
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

> **⚠️ Nota doc 05:** O doc 05 diz que a Organizadora escreve em
> `analytics.linguistic_hints` e `analytics.conversation_classifications`.
> A implementação real (2026-04-29) escreve somente em
> `analytics.conversation_facts` + `analytics.fact_evidence`.
> O doc 05 precisa ser corrigido para refletir o comportamento implementado.

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

## 4. Código TypeScript — Atendente (NÃO INICIADA)

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

1. **Redeploy farejador-pneus** — fix do SAVEPOINT (`851fdd5`) precisa ir para prod
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
