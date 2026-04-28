# 00 - Estado de Implementacao da Fase 3

> **Data:** 2026-04-28
> **Autor:** Kimi
> **Status:** Documentacao completa, codigo nao iniciado

## Resumo Executivo

A Fase 3 (Agente Conversacional) esta **100% no papel**. A documentacao de arquitetura esta completa (18 documentos), as migrations SQL estao escritas (0013-0021), mas **nenhuma tabela existe no banco de producao** e **nenhum codigo TypeScript executavel foi escrito**.

---

## Inventario por Categoria

### 1. Documentacao (CONCLUIDA)

| Doc | Titulo | Status |
|---|---|---|
| 01 | Visao Geral | ✅ Completo |
| 02 | Principios Operacionais | ✅ Completo |
| 03 | Mapa de Dados | ✅ Completo |
| 04 | Blocos do Banco | ✅ Completo |
| 05 | Fact Ledger (Organizadora) | ✅ Completo |
| 06 | Agent State (Atendente) | ✅ Completo |
| 07 | Commerce Grafo Veicular | ✅ Completo |
| 08 | Business Intelligence | ✅ Completo |
| 09 | Skills, Router e Validadores | ✅ Completo |
| 10 | Plano de Fases | ✅ Completo |
| 11 | Perguntas Abertas | ✅ Completo |
| 12 | Context Builder e Slot Filling | ✅ Completo |
| 13 | Fluxo de Eventos e Integracao | ✅ Completo |
| 14 | Topologia de Execucao | ✅ Completo |
| 15 | Shadow Assisted Mode | ✅ Completo |
| 16 | Planejamento de Tabelas em Portugues | ✅ Completo |
| 17 | Mapa Portugues-Ingles | ✅ Completo |
| 18 | Diagrama ER | ✅ Completo |

### 2. Migrations SQL (ESCRITAS, NAO APLICADAS)

| Migration | Conteudo | Status no Banco |
|---|---|---|
| 0013_commerce_layer.sql | 15 tabelas commerce.* | ❌ Nao existe |
| 0014_commerce_indexes.sql | Indices pg_trgm, preco, estoque | ❌ Nao existe |
| 0015_commerce_views.sql | Views current_prices, product_full, customer_profile | ❌ Nao existe |
| 0016_agent_layer.sql | 8 tabelas agent.* + view pending_human_closures | ❌ Nao existe |
| 0017_agent_triggers.sql | Validacoes cross-table, updated_at, append-only | ❌ Nao existe |
| 0018_analytics_evidence.sql | fact_evidence + views current_facts/current_classifications | ❌ Nao existe |
| 0019_ops_phase3_additions.sql | atendente_jobs, unhandled_messages, agent_incidents + funcoes enqueue | ❌ Nao existe |
| 0020_vehicle_fitment_validation.sql | find_compatible_tires, resolve_neighborhood, build_escalation_summary + agent_dashboard | ❌ Nao existe |
| 0021_environment_match_guards.sql | 30+ triggers env_match cross-table | ❌ Nao existe |

### 3. Tipos TypeScript (ESCRITOS, NAO CONSUMIDOS)

| Arquivo | Conteudo | Importado em runtime? |
|---|---|---|
| `src/shared/types/agent.ts` | Tipos de sessao, turno, carrinho, draft, escalacao | ❌ Nao |
| `src/shared/types/commerce.ts` | Tipos de produto, pneu, veiculo, fitment, pedido | ❌ Nao |
| `src/shared/types/analytics-phase3.ts` | Tipos de evidence, views | ❌ Nao |
| `src/shared/types/ops-phase3.ts` | Tipos de jobs, incidentes | ❌ Nao |
| `src/shared/zod/agent-actions.ts` | Schemas Zod de acoes do agente | ❌ Nao |
| `src/shared/zod/fact-keys.ts` | Chaves de fatos validadas | ❌ Nao |

### 4. Codigo de Runtime (INEXISTENTE)

| Componente | Status | Arquivo esperado |
|---|---|---|
| Farejador API (atualizado) | ❌ Nao existe | `src/farejador/` |
| Atendente Worker | ❌ Nao existe | `src/atendente/` |
| Organizadora Worker | ❌ Nao existe | `src/organizadora/` |
| Supervisora Worker | ❌ Nao existe | `src/supervisora/` (futuro) |
| Entrypoints | ❌ Nao existe | `dist/farejador.js`, `dist/atendente.js`, `dist/organizadora.js` |

### 5. Tabelas no Banco (FASE 3)

| Schema | Tabelas Documentadas | Tabelas no Banco Real |
|---|---|---|
| `commerce` | 15 | **0** |
| `agent` | 8 | **0** |
| `analytics.fact_evidence` | 1 | **0** |
| `ops.atendente_jobs` | 1 | **0** |
| `ops.unhandled_messages` | 1 | **0** |
| `ops.agent_incidents` | 1 | **0** |

---

## Tabelas Fora do Escopo das Migrations

As seguintes tabelas existem no banco mas **nao estao em nenhuma migration do repo** (0001-0021):

| Tabela | Schema | Registros | Documentada na Fase 3? | Origem |
|---|---|---|---|---|
| `customer_journey` | `analytics` | 0 | ✅ Sim (doc 04, 16) | **A confirmar com Opus** |
| `bot_events` | `ops` | 0 | ✅ Sim (doc 04, 16) | **A confirmar com Opus** |
| `erasure_log` | `ops` | 0 | ✅ Sim (doc 04, 16) | **A confirmar com Opus** |
| `stock_snapshots` | `ops` | 0 | ✅ Sim (doc 04, 16, 18) | **A confirmar com Opus** |

> **Nota:** Essas 4 tabelas estao documentadas na Fase 3 como "ja existem e continuam sendo usadas", mas nao ha migration versionada para elas no repo. Wallace/Opus precisam confirmar a origem.

---

## Checklist de Progresso

### Etapa A - Documentacao
- [x] 18 documentos de arquitetura
- [x] ADR-004 aprovado
- [x] DATA_DICTIONARY.md atualizado
- [x] extraction-schema.json (segmento moto-pneus)

### Etapa B - Migrations SQL
- [x] 9 migrations escritas (0013-0021)
- [x] Todas idempotentes (CREATE IF NOT EXISTS)
- [ ] Nenhuma aplicada em banco real
- [ ] Validacao em staging pendente (Wallace)

### Etapa C - Codigo TypeScript
- [ ] `src/farejador/` - webhook receiver atualizado
- [ ] `src/atendente/` - worker async
- [ ] `src/organizadora/` - worker async
- [ ] `src/shared/repositories/` - AgentRepo, CommerceRepo
- [ ] `src/shared/validators/` - SayValidator, ActionValidator
- [ ] `src/shared/llm-clients/` - cliente LLM
- [ ] Entrypoints no package.json

### Etapa D - Shadow Assistido
- [ ] Feature flag `ATENDENTE_ENABLED=false`
- [ ] Organizadora rodando com dados reais
- [ ] Calibracao semanal

### Etapa E - Atendente em v1
- [ ] `ATENDENTE_ENABLED=true`
- [ ] Humanos supervisionando via escalacao

### Etapa F - BI
- [ ] Views analiticas materializadas
- [ ] Dashboard

---

## Proximos Passos Recomendados

1. **Wallace:** Aplicar migrations 0013-0021 em ambiente staging/teste (C1).
2. **Opus:** Confirmar origem das 4 tabelas sem migration (A2).
3. **Kimi (quando autorizado):** Iniciar codigo TypeScript da Fase 3, comecando por `src/shared/repositories/` e entrypoints.

---

## Dependencias para Iniciar Codigo

| Dependencia | Status | Bloqueia |
|---|---|---|
| Migrations aplicadas em staging | ❌ Pendente | Todos os repos |
| Provider de LLM definitivo | ❌ Pendente (doc 11) | Atendente + Organizadora |
| Decisao PII no prompt | ❌ Pendente (doc 11) | Atendente |
| Politica retry/fallback LLM | ❌ Pendente (doc 11) | Atendente + Organizadora |

*Documento criado by Kimi (2026-04-28)*
