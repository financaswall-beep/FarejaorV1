# 18 - Diagrama ER (Relacionamentos)

## Por que este documento existe

O doc 16 lista campos por tabela mas nao mostra **como elas se conectam** visualmente.

Sem este doc, FK orfa passa despercebido ate virar bug em runtime.

Aqui esta o mapa textual dos FKs entre as tabelas da Fase 3.

## Notacao

```text
A --1:N--> B    A tem muitos B (1 para muitos)
A --1:1--> B    A tem um B (1 para um, com UNIQUE em B)
A <-?--> B      relacionamento opcional (nullable FK)
A <-------> B   bidirecional via tabela ponte
```

## Bloco 1 - Catalogo (commerce.*)

```text
commerce.products
  --1:N--> commerce.tire_specs (product_id)
  --1:N--> commerce.product_media (product_id)
  --1:N--> commerce.stock_levels (product_id)
  --1:N--> commerce.product_prices (product_id)

commerce.vehicle_models
  --1:N--> commerce.vehicle_fitments (vehicle_model_id)
  --1:N--> commerce.fitment_discoveries (vehicle_model_id)

commerce.tire_specs
  --1:N--> commerce.vehicle_fitments (tire_spec_id)
  --1:N--> commerce.fitment_discoveries (tire_spec_id)

commerce.geo_resolutions
  --1:N--> commerce.delivery_zones (geo_resolution_id)
  --1:N--> commerce.orders (geo_resolution_id, opcional)
  --1:N--> agent.order_drafts (geo_resolution_id, opcional)

commerce.fitment_discoveries
  -?--> commerce.vehicle_fitments (promoted_to_fitment_id, opcional)
  -?--> core.conversations (evidence_conversation_id, opcional)

commerce.import_batches
  --1:N--> commerce.import_errors (import_batch_id)
```

## Bloco 2 - Pedidos (commerce.orders + agent.order_drafts)

```text
core.contacts
  --1:N--> commerce.orders (contact_id)

core.conversations
  --1:N--> commerce.orders (source_conversation_id, opcional)
  --1:1--> agent.order_drafts (conversation_id, UNIQUE)

commerce.geo_resolutions
  --1:N--> commerce.orders (geo_resolution_id, opcional)

commerce.orders
  --1:N--> commerce.order_items (order_id)

commerce.order_items
  --N:1--> commerce.products (product_id)

agent.order_drafts
  -?--> commerce.orders (promoted_order_id, opcional)
  -?--> commerce.geo_resolutions (geo_resolution_id, opcional)
```

Fluxo de promocao: `agent.order_drafts.draft_status` vai de `collecting` para `ready` para `promoted`. Quando promove, `promoted_order_id` aponta para `commerce.orders` recem-criada e `promoted_at` registra quando.

## Bloco 3 - Estado do agente (agent.*)

```text
core.conversations
  --1:1--> agent.session_current (conversation_id, UNIQUE)
  --1:N--> agent.session_events (conversation_id)
  --1:N--> agent.turns (conversation_id)
  --1:1--> agent.cart_current (conversation_id, UNIQUE)
  --1:1--> agent.order_drafts (conversation_id, UNIQUE)
  --1:N--> agent.cart_events (conversation_id)
  --1:N--> agent.pending_confirmations (conversation_id)
  --1:N--> agent.escalations (conversation_id)

agent.cart_current
  --1:N--> agent.cart_current_items (cart_id)

agent.cart_current_items
  --N:1--> commerce.products (product_id)

agent.cart_events
  -?--> agent.cart_current_items (affected_item_id, opcional)

agent.turns
  --N:1--> core.messages (trigger_message_id, UNIQUE com agent_version)
  -?--> core.messages (delivered_message_id, opcional)

agent.pending_confirmations
  --N:1--> core.messages (question_message_id)
  -?--> core.messages (resolved_by_message_id, opcional)

agent.session_current
  -?--> core.messages (last_customer_message_id, opcional)
  -?--> agent.turns (last_agent_turn_id, opcional)
```

## Bloco 4 - Interpretacao (analytics.*)

```text
core.conversations
  --1:N--> analytics.conversation_facts (conversation_id) [JA EXISTE]
  --1:N--> analytics.conversation_classifications (conversation_id) [JA EXISTE]
  --1:N--> analytics.conversation_signals (conversation_id) [JA EXISTE]
  --1:N--> analytics.linguistic_hints (conversation_id) [JA EXISTE]

core.contacts
  --1:1--> analytics.customer_journey (contact_id, UNIQUE) [JA EXISTE]

analytics.conversation_facts
  --1:N--> analytics.fact_evidence (fact_id) [NOVA]
  -?--> analytics.conversation_facts (superseded_by_id, opcional, NOVA na Fase 3)

analytics.fact_evidence
  --N:1--> core.messages (from_message_id)
```

## Bloco 5 - Operacao (ops.*)

```text
core.conversations
  --1:N--> ops.atendente_jobs (conversation_id) [NOVA]
  --1:N--> ops.enrichment_jobs (conversation_id) [JA EXISTE, ganha campos]
  --1:N--> ops.unhandled_messages (conversation_id)
  --1:N--> ops.agent_incidents (conversation_id)

core.messages
  --1:1--> ops.atendente_jobs (trigger_message_id, UNIQUE)
  --N:1--> ops.enrichment_jobs (last_message_id)
  --N:1--> ops.enrichment_jobs (last_processed_message_id)
  --1:N--> ops.unhandled_messages (message_id)

agent.turns
  --1:N--> ops.agent_incidents (agent_turn_id, opcional)
```

## Visao macro consolidada

```text
                      ┌─────────────────────────┐
                      │   core (Chatwoot)       │
                      │  contacts               │
                      │  conversations          │
                      │  messages               │
                      └─────────────────────────┘
                          │             │
        ┌─────────────────┘             └──────────────────┐
        │                                                  │
        ▼                                                  ▼
┌──────────────┐                                  ┌─────────────────┐
│  agent.*     │                                  │  analytics.*    │
│  rascunho    │  ←--- evidence (ledger) ---      │  fatos          │
│  estado vivo │                                  │  classificacoes │
└──────────────┘                                  └─────────────────┘
        │                                                  ▲
        │ promove (order_drafts.promoted_order_id)         │
        ▼                                                  │
┌──────────────┐                                  ┌─────────────────┐
│ commerce.*   │                                  │   ops.*         │
│ catalogo     │                                  │   filas         │
│ pedidos      │                                  │   incidentes    │
│ fitments     │                                  └─────────────────┘
└──────────────┘
        ▲
        │ catalogo
        │
┌──────────────┐
│ raw.*        │  imutavel (Chatwoot bruto)
└──────────────┘
```

## Fluxo de uma conversa (referencias entre tabelas)

```text
1. Mensagem chega
   raw.webhook_events
     ↓ normaliza
   core.messages
     ↓
   ops.atendente_jobs (trigger_message_id = nova msg)
   ops.enrichment_jobs (upsert por conversation_id)

2. Atendente Worker pega job
   le: agent.session_current, agent.cart_current, agent.order_drafts,
       analytics.conversation_facts, analytics.customer_journey, commerce.products
   chama LLM Atendente
   valida { say, actions }
   action handlers escrevem: agent.*

3. Atendente posta resposta no Chatwoot
   webhook outgoing chega
   core.messages (sender_type=bot)
   NAO dispara Atendente novo
   nao gera fact sobre cliente isoladamente

4. Conversa fica inativa por 60-120s (ou status=closed)
   Organizadora Worker pega job
   le: core.messages, agent.pending_confirmations resolvidas
   chama LLM Organizadora com extraction-schema
   escreve: analytics.conversation_facts (append),
            analytics.fact_evidence (literal),
            analytics.conversation_classifications (por dimension),
            analytics.customer_journey (UPSERT)

5. Cliente fecha pedido (futuro v1)
   action: escalate_to_human (ready_to_close)
   agent.escalations criada
   nota interna no Chatwoot com resumo
   humano fecha manualmente em commerce.orders
   agent.order_drafts.promoted_order_id apontado
```

## Aviso importante - FKs lógicas para `core.messages`

`core.messages` e particionada por `sent_at` (PK composta `(id, sent_at)`). Postgres nao aceita FK simples para tabela com PK composta sem incluir todas as colunas.

**Por isso, todas as referencias a `core.messages` na Fase 3 sao FK LOGICAS** — colunas `UUID` sem `REFERENCES`, com validacao no ETL/repositorio TypeScript.

Padrao ja estabelecido em `analytics.conversation_facts.message_id` (0004) e `analytics.linguistic_hints.message_id` (0004), `ops.stock_snapshots.message_id` (0005), `ops.bot_events.message_id` (0005).

Colunas que sao FK logica para `core.messages`:

```text
agent.session_current.last_customer_message_id
agent.turns.trigger_message_id
agent.turns.delivered_message_id
agent.pending_confirmations.question_message_id
agent.pending_confirmations.resolved_by_message_id
analytics.fact_evidence.from_message_id
ops.atendente_jobs.trigger_message_id
ops.enrichment_jobs.last_message_id
ops.enrichment_jobs.last_processed_message_id
ops.unhandled_messages.message_id
```

Repositorios devem validar existencia antes de gravar.

## FKs reais (com REFERENCES) que precisam ser explicitos no SQL

Lista para a fase B nao esquecer:

```sql
-- agent.* -> core.* / commerce.* (apenas FKs reais; ver lista de FKs lógicas acima)
agent.session_current.conversation_id    REFERENCES core.conversations(id) ON DELETE CASCADE
agent.session_events.conversation_id     REFERENCES core.conversations(id) ON DELETE CASCADE
agent.turns.conversation_id              REFERENCES core.conversations(id) ON DELETE CASCADE
agent.cart_current.conversation_id       REFERENCES core.conversations(id) ON DELETE CASCADE
agent.cart_current_items.cart_id         REFERENCES agent.cart_current(id) ON DELETE CASCADE
agent.cart_current_items.product_id      REFERENCES commerce.products(id)
agent.cart_events.conversation_id        REFERENCES core.conversations(id) ON DELETE CASCADE
agent.pending_confirmations.conversation_id  REFERENCES core.conversations(id) ON DELETE CASCADE
agent.order_drafts.conversation_id       REFERENCES core.conversations(id) ON DELETE CASCADE  UNIQUE
agent.order_drafts.geo_resolution_id     REFERENCES commerce.geo_resolutions(id)
agent.order_drafts.promoted_order_id     REFERENCES commerce.orders(id)
agent.escalations.conversation_id        REFERENCES core.conversations(id) ON DELETE CASCADE

-- commerce.* -> commerce.* / core.*
commerce.tire_specs.product_id           REFERENCES commerce.products(id) ON DELETE CASCADE
commerce.product_media.product_id        REFERENCES commerce.products(id) ON DELETE CASCADE
commerce.stock_levels.product_id         REFERENCES commerce.products(id)
commerce.product_prices.product_id       REFERENCES commerce.products(id)
commerce.vehicle_fitments.vehicle_model_id  REFERENCES commerce.vehicle_models(id)
commerce.vehicle_fitments.tire_spec_id      REFERENCES commerce.tire_specs(id)
commerce.delivery_zones.geo_resolution_id   REFERENCES commerce.geo_resolutions(id)
commerce.orders.contact_id               REFERENCES core.contacts(id)
commerce.orders.source_conversation_id   REFERENCES core.conversations(id)
commerce.orders.geo_resolution_id        REFERENCES commerce.geo_resolutions(id)
commerce.order_items.order_id            REFERENCES commerce.orders(id) ON DELETE CASCADE
commerce.order_items.product_id          REFERENCES commerce.products(id)
commerce.fitment_discoveries.vehicle_model_id    REFERENCES commerce.vehicle_models(id)
commerce.fitment_discoveries.tire_spec_id        REFERENCES commerce.tire_specs(id)
commerce.fitment_discoveries.promoted_to_fitment_id  REFERENCES commerce.vehicle_fitments(id)
commerce.fitment_discoveries.evidence_conversation_id  REFERENCES core.conversations(id)
commerce.import_errors.import_batch_id   REFERENCES commerce.import_batches(id) ON DELETE CASCADE

-- analytics.fact_evidence (NOVA)
analytics.fact_evidence.fact_id          REFERENCES analytics.conversation_facts(id) ON DELETE CASCADE
-- analytics.fact_evidence.from_message_id  -> FK lógica (core.messages é particionada)

-- analytics.conversation_facts.superseded_by já existe em 0004 (auto-referência).

-- ops.* -> core.* / agent.* (apenas FKs reais; ver FKs lógicas acima)
ops.atendente_jobs.conversation_id       REFERENCES core.conversations(id) ON DELETE CASCADE
ops.enrichment_jobs.conversation_id      REFERENCES core.conversations(id) ON DELETE CASCADE
ops.unhandled_messages.conversation_id   REFERENCES core.conversations(id) ON DELETE CASCADE
ops.agent_incidents.conversation_id      REFERENCES core.conversations(id) ON DELETE SET NULL
ops.agent_incidents.agent_turn_id        REFERENCES agent.turns(id) ON DELETE SET NULL
```

## Constraints UNIQUE chave

```sql
agent.session_current   UNIQUE (environment, conversation_id)
agent.cart_current      UNIQUE (environment, conversation_id)
agent.order_drafts      UNIQUE (environment, conversation_id)
agent.turns             UNIQUE (environment, trigger_message_id, agent_version)

ops.atendente_jobs      UNIQUE (environment, trigger_message_id)
ops.enrichment_jobs     UNIQUE (environment, conversation_id, job_type)
                        WHERE status IN ('pending','processing')

analytics.fact_evidence UNIQUE (fact_id, from_message_id, evidence_type)
```

## Validacoes que precisam de trigger (CHECK cross-table nao funciona)

```text
1. vehicle_fitments.position vs vehicle_models.vehicle_type
   - se vehicle_type = 'motorcycle', position permite ('front','rear','both')
   - se vehicle_type = 'car', position permite outras combinacoes
   - PostgreSQL CHECK nao aceita subselect. Trigger BEFORE INSERT/UPDATE.

2. order_items.unit_price vs product_prices.price_amount
   - aviso (nao bloqueio) se discrepancia > 50%
   - vira ops.agent_incidents nivel medium

3. fact_evidence.evidence_type = 'literal' exige evidence_text nao nulo
   - CHECK normal funciona aqui (mesma linha)

4. agent.order_drafts.draft_status = 'promoted' exige promoted_order_id nao nulo
   - CHECK normal funciona

5. agent.cart_current.cart_status = 'promoted' exige todos os itens com status 'confirmed'
   - trigger AFTER UPDATE
```

## Notas finais

- Schemas `raw.*` e `core.*` ja existem. Fase 3 nao mexe.
- Schemas `analytics.*` e `ops.*` existem em parte. Fase 3 adiciona/altera tabelas marcadas como `[NOVA]` ou `[ja existe, ganha campos]`.
- Schemas `agent.*` e `commerce.*` sao 100% novos na Fase 3.
- Convencoes de nome canonico estao no doc 17.
- Mapeamento pt -> en estao no doc 17.
