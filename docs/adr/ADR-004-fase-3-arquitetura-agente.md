# ADR-004 â€” Arquitetura da Fase 3 (Agente Conversacional)

## Status
Aceito.

## Data
2026-04-27

## Contexto

A Fase 3 introduz dois LLMs ao sistema: **Organizadora** (interpreta conversas em backstage) e **Atendente** (conversa com o cliente em tempo real). Antes da Fase 3, o Farejador era determinÃ­stico (ADR-002). LLMs trazem custo, latÃªncia, alucinaÃ§Ã£o e schema aberto se mal arquitetadas.

A experiÃªncia prÃ©via de um agente em produÃ§Ã£o (beta agente) mostrou os riscos reais:

- schema aberto: a LLM inventava chaves novas a cada conversa;
- estado mutÃ¡vel: `contexto_conversa` era sobrescrito a cada turno, perdendo histÃ³rico;
- alucinaÃ§Ã£o operacional: agente prometia preÃ§o/estoque sem fonte;
- regras demais: tentando frear a LLM, o sistema virou Ã¡rvore de regex e if;
- linearidade: funil tratado como escada, agente travava em fluxo rÃ­gido.

A arquitetura da Fase 3 foi desenhada explicitamente para **evitar cada um desses problemas**.

## DecisÃ£o

### 1. SeparaÃ§Ã£o em trÃªs papÃ©is lÃ³gicos com latÃªncias diferentes

```
Farejador API        (sÃ­ncrono, 200-rÃ¡pido)
Atendente Worker     (async, baixa latÃªncia)
Organizadora Worker  (async, debounce/alta latÃªncia)
```

Webhook do Chatwoot **nunca** dispara LLM no path sÃ­ncrono. Atendente Ã© worker async acionado por `ops.atendente_jobs`. Organizadora Ã© worker async acionado por `ops.enrichment_jobs` com debounce de 60-120s.

### 2. Schema fechado de fact_keys (extraction-schema.json)

A Organizadora extrai fatos apenas de uma whitelist versionada (`segments/moto-pneus/extraction-schema.json`). Chave fora da whitelist Ã© rejeitada e gera `ops.agent_incidents` com `schema_violation`.

Resolve o problema de schema aberto do beta.

### 3. Ledger append-only com evidence obrigatÃ³ria

`analytics.conversation_facts` nunca recebe DELETE nem UPDATE de valor. MudanÃ§a de fato gera nova linha + `superseded_by_id` apontando pra anterior. Toda extraÃ§Ã£o da LLM exige `analytics.fact_evidence` com texto literal e `from_message_id`.

Resolve o problema de estado mutÃ¡vel e auditoria zero do beta.

### 4. Slot filling em `agent.*`, separado de `commerce.*`

Dados operacionais coletados durante a conversa (nome, itens, endereÃ§o, pagamento) ficam em `agent.cart_current` + `agent.order_drafts`. **NÃ£o** em `commerce.*`. Pedido sÃ³ nasce em `commerce.orders` quando confirmado e promovido (com `promoted_order_id` cruzando os dois).

```
agent.*     vivo, mutÃ¡vel, rascunho, intenÃ§Ã£o
commerce.*  fato consumado, venda confirmada
```

### 5. Action handler como Ãºnica ponte entre LLM e banco

A LLM Atendente nunca toca o banco. Devolve `{ say, actions }`. Cada action passa por:

```
Say Validator    (audita texto livre)
Action Validator (audita action estruturada)
Action Handler   (executa write, sempre TypeScript)
```

A LLM **decide**, o cÃ³digo **valida e executa**. Resolve o problema de alucinaÃ§Ã£o operacional do beta.

### 6. Regras negativas, nÃ£o positivas

Anti-padrÃ£o explÃ­cito no doc 02: nada de "se cliente disser X, responder Y". As regras do sistema sÃ£o **freios** ("nÃ£o inventar preÃ§o sem fonte"), nÃ£o scripts de fala. A LLM tem liberdade conversacional dentro do trilho operacional.

Resolve o problema de "regras demais" do beta.

### 7. Funil como mapa, nÃ£o escada

Router determinÃ­stico considera **mensagem atual** com prioridade sobre estado consolidado. Cliente pode entrar pelo fundo, voltar ao topo, pular para objeÃ§Ã£o. Skill `responder_geral` Ã© fallback que sempre grava `ops.unhandled_messages` para criar skill nova.


**Refinamento 2026-04-29:** o Sprint 1 da Atendente v1 manteve esta decisao
conceitual, mas refinou a implementacao: a escolha de skill passa a ser feita
por Planner constrained/read-only sobre um estado reentrante (`session_items` +
`session_slots`). Mutacao continua proibida para a LLM e passa apenas por
actions validadas. Ver
`docs/phase3-agent-architecture/21-atendente-v1-state-design.md`.
### 8. Lexicon mÃ­nimo permitido apenas com `pending_confirmation` aberta

Regex/lexical **sÃ³** quando hÃ¡ contexto explÃ­cito de confirmaÃ§Ã£o. Fora disso, a LLM Atendente decide via action estruturada. Anti-padrÃ£o "regra para frase" mantido.

### 9. Postgres como fila no v1

Sem Redis, sem RabbitMQ. `ops.atendente_jobs` e `ops.enrichment_jobs` usam `SELECT ... FOR UPDATE SKIP LOCKED` com debounce via `not_before` e upsert por conversa. TransaÃ§Ã£o nativa garante "enfileirar + gravar core.messages" no mesmo commit.

### 10. Shadow Assistido por 5 semanas antes de ligar Atendente

Antes da LLM Atendente entrar em produÃ§Ã£o, Wallace atende manualmente por ~5 semanas. Farejador captura, Organizadora interpreta, `analytics.*` calibra com ~3.500 conversas reais. Atendente fica desligada por feature flag.

Quando ligar, ela jÃ¡ tem hint/perfil dos clientes recorrentes. NÃ£o nasce cega.

### 11. Codebase compartilhada, trÃªs entrypoints

```
src/farejador/      webhook receiver
src/atendente/      worker
src/organizadora/   worker
src/shared/         tipos, repos, schemas, validators
```

Mesma imagem Docker, trÃªs `command:` diferentes. Deploy v1: 3 serviÃ§os no Coolify. Fallback: 1 container com 3 processos.

## ConsequÃªncias

### Positivas

- LLM travada nunca derruba webhook;
- alucinaÃ§Ã£o operacional fica restrita ao `say`, contidos pelo Say Validator;
- ledger auditÃ¡vel: cada fact tem evidence literal + message_id;
- replay e backfill possÃ­veis (reprocessa `raw.*` regenera `analytics.*`);
- schema fechado = custo previsÃ­vel da LLM (prompt menor, parsing barato);
- separaÃ§Ã£o `agent.*` / `commerce.*` = relatÃ³rio fiscal nÃ£o suja com rascunho;
- shadow de 5 semanas = produto nasce calibrado, nÃ£o com hipÃ³teses;
- 3 latÃªncias distintas escalam independente.

### Negativas

- 3 processos = 3x healthchecks, 3x logs, mais variÃ¡vel no Coolify;
- shadow de 5 semanas = atraso de produto em troca de confiabilidade;
- ledger append-only = banco cresce mais rÃ¡pido (mitigado por particionamento futuro);
- schema fechado = exige rodada de calibraÃ§Ã£o quando novo segmento entrar (carro, etc.);
- Postgres como fila = funciona atÃ© ~50 jobs/s, depois precisa de Redis (v2).

## Alternativas consideradas

### Atendente sÃ­ncrona ao webhook

Rejeitada. Quebra o princÃ­pio "200-rÃ¡pido" do Farejador. Webhook do Chatwoot tem timeout, LLM lenta vira retry storm.

### Schema aberto com revisÃ£o posterior

Rejeitada. Foi o que o beta agente fez e gerou tabela `contexto_conversa` com 30+ chaves inventadas. Custo de limpeza retroativa Ã© alto.

### Resumidor textual como camada intermediÃ¡ria

Rejeitada (na conversa com Codex). Resumo textual gerado por LLM como verdade operacional Ã© exatamente onde o beta alucinava. SubstituÃ­do por views determinÃ­sticas e resumo on-demand do Context Builder.

### Misturar slot filling em commerce.draft_orders

Rejeitada. Codex apontou: rascunho nÃ£o Ã© venda. MantÃ©m `agent.order_drafts` separado.

### Detector lexical para confirmaÃ§Ã£o implÃ­cita

Rejeitada (escopo geral). Aceita apenas dentro de `agent.pending_confirmations` aberto. Anti-padrÃ£o "regra para frase" do doc 02 mantido fora desse escopo.

## VÃ­nculos

- ADR-002 (determinismo do Farejador) continua vÃ¡lido para `raw.*` e `core.*`. ADR-004 nÃ£o derruba ADR-002, **estende** com camadas LLM em `analytics.*` e `agent.*`.
- DocumentaÃ§Ã£o detalhada nos mini-docs `docs/phase3-agent-architecture/01` ao `18`.
- Plano de implementaÃ§Ã£o no doc 10. Topologia no doc 14. Fluxo de eventos no doc 13.

## PrÃ³ximos passos apÃ³s este ADR

1. Migrations 0013-0020 (Fase B);
2. RepositÃ³rios e validators TypeScript;
3. Worker da Organizadora (Fase C2);
4. Shadow Assistido de 5 semanas (Fase C3);
5. Atendente liga em v1 (Fase D);
6. BI rei dos dados (Fase E).

