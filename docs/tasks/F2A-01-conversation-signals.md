# F2A-01 - Conversation signals genericos

## Objetivo

Implementar a primeira entrega da Fase 2a: calculo deterministico de
`analytics.conversation_signals`.

Essa task nao envolve texto, regex, pneu ou classificacao comercial.

## Escopo

Criar um servico que recebe uma conversa ou lote de conversas em `core.*` e grava
metricas estruturais em `analytics.conversation_signals`.

Metricas esperadas:

- `total_messages`;
- `contact_messages`;
- `agent_messages`;
- `bot_messages`;
- `media_message_count`;
- `media_text_ratio`;
- `first_response_seconds`;
- `avg_agent_response_sec`;
- `max_gap_seconds`;
- `total_duration_seconds`;
- `handoff_count`;
- `started_hour_local`;
- `started_dow_local`.

## Arquivos que pode criar/alterar

- `src/enrichment/signals.service.ts`
- `src/enrichment/signals.repository.ts`
- `src/enrichment/index.ts` se necessario
- `tests/unit/enrichment/signals.service.test.ts`
- `tests/unit/enrichment/signals.repository.test.ts`
- `docs/tasks/F2A-01-conversation-signals.md`

Nao criar worker automatico nesta task.

## Regras

- Escrever somente em `analytics.conversation_signals`.
- Ler somente de `core.*`.
- Nao escrever em `raw.*` ou `core.*`.
- Nao chamar LLM.
- Nao criar `segments/`.
- Nao alterar migrations antigas.
- Nao adicionar dependencia.

## Padrao de provenance

Usar:

```text
source = sql_aggregation_v1
truth_type = observed
confidence_level = 1.00
extractor_version = f2a_signals_v1
```

## Idempotencia

Rodar duas vezes deve atualizar a mesma linha de `analytics.conversation_signals`,
nao duplicar.

Como a tabela usa `conversation_id` como PK, usar upsert.

## Testes obrigatorios

Criar testes unitarios cobrindo:

- conversa sem mensagens;
- conversa com mensagens de contato e agente;
- primeiro tempo de resposta;
- maior gap entre mensagens;
- handoff_count vindo de assignments;
- media_text_ratio quando ha anexos;
- idempotencia do upsert no SQL.

## Validacao

Obrigatorio:

```powershell
npm run typecheck
npm test
npm run build
```

Supabase real e opcional nesta task. Se nao for executado, registrar como pendencia.

