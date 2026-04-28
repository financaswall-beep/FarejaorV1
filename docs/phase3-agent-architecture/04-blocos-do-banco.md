# 04 - Blocos do Banco

## Bloco 1 - Conversa bruta

Ja existe no Farejador.

- `raw.raw_events`
- `raw.delivery_seen`
- `core.contacts`
- `core.conversations`
- `core.messages`
- `core.message_attachments`
- `core.conversation_tags`
- `core.conversation_status_events`
- `core.conversation_assignments`
- `core.message_reactions`

Frase simples: o que o cliente disse e o que o Chatwoot mandou.

## Bloco 2 - Interpretacao da conversa

Ja existe em parte. Ganha evidencia forte.

- `analytics.conversation_signals`
- `analytics.linguistic_hints`
- `analytics.conversation_facts`
- `analytics.conversation_classifications`
- `analytics.customer_journey`
- `analytics.fact_evidence`

Views:

- `analytics.current_facts`
- `analytics.current_classifications`

Frase simples: o que entendemos do que o cliente disse.

## Bloco 3 - Catalogo da loja

Novo. Schema `commerce.*`.

- `commerce.products`
- `commerce.tire_specs`
- `commerce.vehicle_models`
- `commerce.vehicle_fitments`
- `commerce.product_media`
- `commerce.stock_levels`
- `commerce.product_prices`
- `commerce.delivery_zones`
- `commerce.store_policies`
- `commerce.orders`
- `commerce.order_items`
- `commerce.import_batches`
- `commerce.import_errors`
- `commerce.geo_resolutions` (documentada como "bairros e municipios" no doc 16)
- `commerce.fitment_discoveries`

Views:

- `commerce.current_prices`
- `commerce.customer_profile`

Frase simples: o que a loja vende e como vende.

## Bloco 4 - Estado do agente

Novo. Schema `agent.*`.

- `agent.session_events`
- `agent.session_current`
- `agent.turns`
- `agent.pending_confirmations`
- `agent.cart_events`
- `agent.cart_current`
- `agent.cart_current_items`
- `agent.order_drafts`
- `agent.escalations`

Frase simples: o que o agente esta fazendo agora.

## Bloco 5 - Operacao e aprendizado

Ja existe em parte. Ganha itens novos.

- `ops.enrichment_jobs`
- `ops.atendente_jobs`
- `ops.erasure_log`
- `ops.stock_snapshots`
- `ops.bot_events`
- `ops.orphan_conversation_stubs`
- `ops.unhandled_messages`
- `ops.agent_incidents`

Frase simples: como o sistema se monitora e aprende onde esta falhando.

## Temperatura das estruturas

### Quentes

Tocadas no cotidiano do atendimento.

- `core.messages`
- `core.contacts`
- `core.conversations`
- `analytics.conversation_facts`
- `analytics.conversation_classifications`
- `analytics.linguistic_hints`
- `analytics.fact_evidence`
- `commerce.products`
- `commerce.tire_specs`
- `commerce.vehicle_models`
- `commerce.vehicle_fitments`
- `commerce.stock_levels`
- `commerce.delivery_zones`
- `commerce.store_policies`
- `commerce.product_media`
- `agent.session_current`
- `agent.session_events`
- `agent.turns`
- `agent.pending_confirmations`
- `agent.cart_current`
- `agent.cart_current_items`
- `agent.cart_events`
- `agent.order_drafts`

### Mornas

Tocadas em situacoes especificas.

- `commerce.geo_resolutions`
- `commerce.fitment_discoveries`
- `commerce.product_prices`
- `agent.escalations`
- `analytics.conversation_signals`
- `analytics.customer_journey`
- `ops.unhandled_messages`
- `ops.enrichment_jobs`
- `ops.atendente_jobs`

### Frias

Auditoria, historico e importacao.

- `raw.raw_events`
- `raw.delivery_seen`
- `core.message_attachments`
- `core.conversation_tags`
- `core.conversation_status_events`
- `core.conversation_assignments`
- `core.message_reactions`
- `commerce.orders`
- `commerce.order_items`
- `commerce.import_batches`
- `commerce.import_errors`
- `ops.erasure_log`
- `ops.bot_events`
- `ops.agent_incidents`
- `ops.stock_snapshots`

### Views

- `analytics.current_facts`
- `analytics.current_classifications`
- `commerce.current_prices`
- `commerce.customer_profile`
- `ops.orphan_conversation_stubs`
