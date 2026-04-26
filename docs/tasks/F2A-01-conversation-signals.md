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

Criar tambem um CLI minimo:

```text
npm run enrich -- --conversation-id=<uuid> --segment=generic
```

Nesta task, o argumento `--segment` pode ser aceito e ignorado com log claro, porque
o motor de regras so entra na F2A-02. O CLI deve executar signals para a conversa
informada.

## Arquivos que pode criar/alterar

- `src/enrichment/signals.service.ts`
- `src/enrichment/signals.repository.ts`
- `src/enrichment/cli.ts`
- `src/enrichment/index.ts` se necessario
- `tests/unit/enrichment/signals.service.test.ts`
- `tests/unit/enrichment/signals.repository.test.ts`
- `tests/unit/enrichment/enrichment.cli.test.ts`
- `package.json` apenas para adicionar script `enrich`
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

## Versionamento

`analytics.conversation_signals` e snapshot atual por conversa. A tabela tem
`conversation_id` como primary key, portanto usar upsert e sobrescrever os sinais
estruturais atuais.

Historico por versao nao entra nesta task.

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
- idempotencia do upsert no SQL;
- CLI aceita `--conversation-id` e chama o servico;
- garantia textual de que o SQL nao contem INSERT/UPDATE em `raw.` ou `core.`.

## Validacao

Obrigatorio:

```powershell
npm run typecheck
npm test
npm run build
```

Supabase real e opcional nesta task. Se nao for executado, registrar como pendencia.

---

## Entrega F2A-01

### Arquivos alterados
- `src/enrichment/signals.service.ts` (criado)
- `src/enrichment/signals.repository.ts` (criado)
- `src/enrichment/cli.ts` (criado)
- `src/enrichment/index.ts` (criado)
- `tests/unit/enrichment/signals.service.test.ts` (criado)
- `tests/unit/enrichment/signals.repository.test.ts` (criado)
- `tests/unit/enrichment/enrichment.cli.test.ts` (criado)
- `package.json` (modificado - adicionado script `enrich`)
- `docs/tasks/F2A-01-conversation-signals.md` (modificado - registro de entrega e auditoria)

### Checklist
- [x] `src/enrichment/signals.service.ts` delega calculo ao repository.
- [x] `src/enrichment/signals.repository.ts` calcula todas as 13 metricas via SQL CTEs e faz upsert em `analytics.conversation_signals`.
- [x] Provenance obrigatoria: `source=sql_aggregation_v1`, `truth_type=observed`, `confidence_level=1.00`, `extractor_version=f2a_signals_v1`.
- [x] CLI aceita `--conversation-id=<uuid>` e opcional `--segment=generic` (ignorado com log).
- [x] CLI usa `env.FAREJADOR_ENV` centralizado, sem default local paralelo.
- [x] CLI fecha o pool no caminho de execucao direta.
- [x] CLI falha explicitamente quando a conversa nao existe no ambiente selecionado.
- [x] Script `npm run enrich` adicionado ao `package.json`.
- [x] Testes unitarios cobrem: parametros, metricas, provenance, leitura somente de core, ausencia de INSERT/UPDATE em raw/core, idempotencia via ON CONFLICT, CLI parseArgs e runCli.
- [x] `npm run typecheck` verde.
- [x] `npm test` 133/133 passaram.
- [x] `npm run build` verde.

### Pendencias
- Validacao Supabase real nao executada: DATABASE_URL nao disponivel nesta sessao.

### Auditoria Codex
- Escopo aprovado: a entrega ficou limitada a F2A-01, sem criar `segments/`, sem alterar migrations antigas e sem tocar em `raw.*` ou `core.*`.
- Ajuste aplicado: `computeAndUpsertSignals` agora retorna `false` quando nenhuma conversa e encontrada, evitando falso positivo no CLI.
- Ajuste aplicado: `runCli` usa `env.FAREJADOR_ENV`, fecha `pool.end()` ao rodar como script e usa deteccao de execucao direta compativel com Windows.
- Ajuste aplicado: testes cobrem conversa inexistente no ambiente selecionado.

### Riscos
- `avg_agent_response_sec` usa LATERAL para encontrar mensagem do contact imediatamente anterior a cada resposta do agente. Em conversas com muitas mensagens (>10k) pode ser custoso; se observado, deve ser otimizado com window functions em task futura.
- `media_text_ratio` retorna NULL quando `total_messages = 0`; comportamento valido segundo regra "retornar NULL em vez de inventar".

### Validacao executada
- `npm run typecheck` -> verde
- `npm test` -> 26 arquivos, 133 testes, todos passaram
- `npm run build` -> verde
- Supabase real -> nao executado (DATABASE_URL nao disponivel nesta sessao)
