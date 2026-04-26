# Prompt para Kimi - F2A-01 conversation signals

Copie e cole este prompt para o Kimi quando for executar a primeira entrega da Fase 2a.

```text
Leia e obedeca docs/KIMI_RULES.md antes de qualquer coisa.

Leia tambem:
- AGENTS.md
- docs/PROJECT.md
- docs/F2A_ARCHITECTURE.md
- docs/F2A_KIMI_IMPLEMENTATION_GUIDE.md
- docs/phases/PHASE_02A.md
- docs/tasks/F2A-01-conversation-signals.md
- docs/CONTRACTS.md
- docs/LOGGING.md

---

## Sua tarefa: F2A-01 - conversation signals genericos

Implementar APENAS a task docs/tasks/F2A-01-conversation-signals.md.

Objetivo:
Calcular metricas estruturais de conversas lendo core.* e gravando somente em
analytics.conversation_signals.

---

## Arquivos permitidos

Voce pode criar/alterar somente:

- src/enrichment/signals.service.ts
- src/enrichment/signals.repository.ts
- src/enrichment/index.ts se necessario
- tests/unit/enrichment/signals.service.test.ts
- tests/unit/enrichment/signals.repository.test.ts
- docs/tasks/F2A-01-conversation-signals.md se precisar registrar detalhe da entrega

Nao crie worker automatico nesta task.
Nao crie segments/.
Nao crie regra de pneus.

---

## Regras absolutas

- Escrever somente em analytics.conversation_signals.
- Ler somente de core.*.
- Nao escrever em raw.*.
- Nao escrever em core.*.
- Nao escrever em ops.*.
- Nao chamar LLM.
- Nao criar endpoint admin.
- Nao alterar migrations antigas.
- Nao adicionar dependencia em package.json.
- Nao alterar src/shared/types/chatwoot.ts.

---

## Provenance obrigatoria

Use:

source = sql_aggregation_v1
truth_type = observed
confidence_level = 1.00
extractor_version = f2a_signals_v1

---

## Metricas obrigatorias

Calcular:

- total_messages
- contact_messages
- agent_messages
- bot_messages
- media_message_count
- media_text_ratio
- first_response_seconds
- avg_agent_response_sec
- max_gap_seconds
- total_duration_seconds
- handoff_count
- started_hour_local
- started_dow_local

Se algum valor nao puder ser calculado sem ambiguidade, retornar NULL em vez de inventar.

---

## Testes obrigatorios

Cobrir:

- conversa sem mensagens;
- conversa com mensagens de contato e agente;
- primeiro tempo de resposta;
- maior gap entre mensagens;
- handoff_count vindo de assignments;
- media_text_ratio quando ha anexos;
- SQL de upsert idempotente em analytics.conversation_signals;
- garantia textual de que o SQL nao contem INSERT/UPDATE em raw. ou core.

---

## Supabase

Nao precisa usar Supabase real nesta task.

Se for usar, siga docs/F2A_KIMI_IMPLEMENTATION_GUIDE.md:
- usar environment=test;
- nunca commitar .env.codex;
- nunca imprimir secrets;
- se DATABASE_URL nao estiver disponivel, registrar pendencia e seguir com testes locais.

---

## Validacao obrigatoria

Execute:

npm run typecheck
npm test
npm run build

Todos devem ficar verdes.

---

## Formato de entrega

Obrigatorio, conforme docs/KIMI_RULES.md:

## Arquivos alterados
## Checklist
## Pendencias
## Riscos

Inclua tambem o resumo da validacao executada.
```
