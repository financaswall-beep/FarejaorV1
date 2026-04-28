-- ============================================================
-- 0016_agent_layer.sql
-- Camada AGENT: estado operacional da LLM Atendente.
-- Schema novo na Fase 3.
-- Idempotente.
-- ============================================================

-- Schema
CREATE SCHEMA IF NOT EXISTS agent;

COMMENT ON SCHEMA agent IS 'Estado operacional do atendimento: sessão atual, turnos da LLM, carrinho, rascunho de pedido, escalações. Mutável, vivo. Não é verdade comercial — pedido oficial fica em commerce.*.';

-- ------------------------------------------------------------
-- session_current — fotografia atual da sessão (1 por conversa)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent.session_current (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment                 env_t       NOT NULL,
  conversation_id             UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  status                      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'escalated', 'closed')),
  current_skill               TEXT,
  last_customer_message_id    UUID,  -- FK lógica para core.messages(id). core.messages é particionada (PK composta), validação no ETL.
  last_agent_turn_id          UUID,  -- FK para agent.turns(id), criada após a tabela existir
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, conversation_id)
);

COMMENT ON TABLE agent.session_current IS 'Snapshot atual da sessão. Regenerável a partir de session_events.';

CREATE INDEX IF NOT EXISTS session_current_status_idx ON agent.session_current (status) WHERE status IN ('active', 'escalated');

-- ------------------------------------------------------------
-- session_events — histórico imutável append-only
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent.session_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         env_t       NOT NULL,
  conversation_id     UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  event_type          TEXT        NOT NULL CHECK (event_type IN ('skill_selected', 'confirmation_requested', 'cart_proposed', 'human_called', 'bot_resumed', 'session_paused', 'session_closed', 'fact_corrected', 'escalation_created')),
  skill_name          TEXT,
  event_payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent.session_events IS 'Histórico imutável de decisões do agente. Append-only. Auditoria total.';

CREATE INDEX IF NOT EXISTS session_events_conv_idx ON agent.session_events (conversation_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS session_events_type_idx ON agent.session_events (event_type, occurred_at DESC);

-- ------------------------------------------------------------
-- turns — cada resposta da LLM Atendente
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent.turns (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment             env_t       NOT NULL,
  conversation_id         UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  trigger_message_id      UUID        NOT NULL,  -- FK lógica para core.messages(id) (tabela particionada).
  selected_skill          TEXT,
  agent_version           TEXT        NOT NULL,
  context_hash            TEXT        NOT NULL,
  say_text                TEXT,
  actions                 JSONB       NOT NULL DEFAULT '[]'::jsonb,
  status                  TEXT        NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'validated', 'delivered', 'failed', 'blocked')),
  delivered_message_id    UUID,  -- FK lógica para core.messages(id).
  llm_duration_ms         INTEGER,
  llm_input_tokens        INTEGER,
  llm_output_tokens       INTEGER,
  error_message           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, trigger_message_id, agent_version)
);

COMMENT ON TABLE agent.turns IS 'Cada resposta da LLM Atendente. Idempotente: mesmo trigger_message_id + agent_version não gera dois turnos.';
COMMENT ON COLUMN agent.turns.context_hash IS 'Hash do contexto montado pelo Context Builder. Mesmo hash + mesmo prompt = mesmo output esperado (auditoria).';

CREATE INDEX IF NOT EXISTS turns_conv_idx ON agent.turns (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS turns_status_idx ON agent.turns (status) WHERE status IN ('generated', 'failed');
CREATE INDEX IF NOT EXISTS turns_skill_idx ON agent.turns (selected_skill, created_at DESC);

-- FK circular agora que turns existe
ALTER TABLE agent.session_current
  DROP CONSTRAINT IF EXISTS session_current_last_agent_turn_fk;

ALTER TABLE agent.session_current
  ADD CONSTRAINT session_current_last_agent_turn_fk
  FOREIGN KEY (last_agent_turn_id) REFERENCES agent.turns(id);

-- ------------------------------------------------------------
-- pending_confirmations — perguntas em aberto
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent.pending_confirmations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment                 env_t       NOT NULL,
  conversation_id             UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  confirmation_type           TEXT        NOT NULL CHECK (confirmation_type IN ('fact_confirmation', 'cart_confirmation', 'order_confirmation', 'fitment_confirmation')),
  expected_facts              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  question_message_id         UUID        NOT NULL,  -- FK lógica para core.messages(id) (tabela particionada).
  status                      TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'expired', 'cancelled')),
  expires_at                  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  resolved_by_message_id      UUID,  -- FK lógica para core.messages(id).
  resolved_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status != 'resolved' OR (resolved_by_message_id IS NOT NULL AND resolved_at IS NOT NULL))
);

COMMENT ON TABLE agent.pending_confirmations IS 'Perguntas que o agente fez e espera resposta. Lexicon mínimo (sim/isso/exato) só roda quando há registro aberto aqui.';

CREATE INDEX IF NOT EXISTS pending_conf_conv_open_idx ON agent.pending_confirmations (conversation_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS pending_conf_expires_idx ON agent.pending_confirmations (expires_at) WHERE status = 'open';

-- ------------------------------------------------------------
-- cart_current — carrinho atual (1 por conversa)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent.cart_current (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         env_t       NOT NULL,
  conversation_id     UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  cart_status         TEXT        NOT NULL DEFAULT 'empty' CHECK (cart_status IN ('empty', 'proposed', 'confirmed', 'validated', 'promoted')),
  estimated_total     NUMERIC(10, 2),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, conversation_id)
);

COMMENT ON TABLE agent.cart_current IS 'Carrinho atual: só itens. Endereço/pagamento em order_drafts. Status promoted = virou commerce.orders.';

CREATE INDEX IF NOT EXISTS cart_current_status_idx ON agent.cart_current (cart_status) WHERE cart_status IN ('proposed', 'confirmed');

-- ------------------------------------------------------------
-- cart_current_items — itens do carrinho atual
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent.cart_current_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment     env_t       NOT NULL,
  cart_id         UUID        NOT NULL REFERENCES agent.cart_current(id) ON DELETE CASCADE,
  product_id      UUID        NOT NULL REFERENCES commerce.products(id),
  quantity        INTEGER     NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC(10, 2) CHECK (unit_price IS NULL OR unit_price >= 0),
  item_status     TEXT        NOT NULL DEFAULT 'proposed' CHECK (item_status IN ('proposed', 'confirmed', 'removed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent.cart_current_items IS 'Linhas do carrinho atual. unit_price NULL se ainda não foi cotado.';

CREATE INDEX IF NOT EXISTS cart_items_cart_idx ON agent.cart_current_items (cart_id) WHERE item_status != 'removed';

-- ------------------------------------------------------------
-- cart_events — histórico imutável do carrinho
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent.cart_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         env_t       NOT NULL,
  conversation_id     UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  event_type          TEXT        NOT NULL CHECK (event_type IN ('proposed', 'confirmed', 'validated', 'promoted', 'removed', 'replaced', 'cleared')),
  affected_item_id    UUID,  -- não FK porque pode referir item removido
  event_payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent.cart_events IS 'Histórico imutável de mudanças no carrinho. Append-only.';

CREATE INDEX IF NOT EXISTS cart_events_conv_idx ON agent.cart_events (conversation_id, occurred_at DESC);

-- ------------------------------------------------------------
-- order_drafts — slots de checkout em tempo real
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent.order_drafts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment             env_t       NOT NULL,
  conversation_id         UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  customer_name           TEXT,
  delivery_address        TEXT,
  geo_resolution_id       UUID        REFERENCES commerce.geo_resolutions(id),
  fulfillment_mode        TEXT        CHECK (fulfillment_mode IN ('delivery', 'pickup') OR fulfillment_mode IS NULL),
  payment_method          TEXT,
  draft_status            TEXT        NOT NULL DEFAULT 'collecting' CHECK (draft_status IN ('collecting', 'ready', 'promoted', 'abandoned')),
  promoted_order_id       UUID        REFERENCES commerce.orders(id),
  promoted_by             TEXT,
  promoted_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, conversation_id),
  CHECK (draft_status != 'promoted' OR promoted_order_id IS NOT NULL),
  CHECK (draft_status != 'promoted' OR promoted_at IS NOT NULL)
);

COMMENT ON TABLE agent.order_drafts IS 'Slots de checkout (nome, endereço, modalidade, pagamento) em tempo real. Promove para commerce.orders quando humano confirma.';
COMMENT ON COLUMN agent.order_drafts.draft_status IS 'collecting (juntando dados) → ready (tudo coletado) → promoted (virou commerce.orders) ou abandoned.';

CREATE INDEX IF NOT EXISTS order_drafts_status_idx ON agent.order_drafts (draft_status) WHERE draft_status IN ('collecting', 'ready');

-- ------------------------------------------------------------
-- escalations — passagem para humano
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent.escalations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment             env_t       NOT NULL,
  conversation_id         UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  reason                  TEXT        NOT NULL CHECK (reason IN ('ready_to_close', 'customer_requested', 'validator_blocked', 'confidence_low', 'pending_expired', 'other')),
  status                  TEXT        NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_attendance', 'resolved', 'returned_to_bot')),
  summary_text            TEXT,
  chatwoot_note_id        TEXT,
  escalated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at             TIMESTAMPTZ,
  resolved_by             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent.escalations IS 'Passagem para humano. v1: humano fecha pedido via Chatwoot lendo summary_text.';

CREATE INDEX IF NOT EXISTS escalations_status_idx ON agent.escalations (status, escalated_at DESC) WHERE status IN ('waiting', 'in_attendance');
CREATE INDEX IF NOT EXISTS escalations_conv_idx ON agent.escalations (conversation_id);

-- ------------------------------------------------------------
-- View: pending_human_closures — fechamentos aguardando humano
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW agent.pending_human_closures AS
SELECT
  e.id                AS escalation_id,
  e.environment,
  e.conversation_id,
  e.reason,
  e.summary_text,
  e.escalated_at,
  od.customer_name,
  od.delivery_address,
  od.fulfillment_mode,
  od.payment_method,
  cc.estimated_total
FROM agent.escalations e
LEFT JOIN agent.order_drafts od
  ON od.conversation_id = e.conversation_id AND od.environment = e.environment
LEFT JOIN agent.cart_current cc
  ON cc.conversation_id = e.conversation_id AND cc.environment = e.environment
WHERE e.status = 'waiting'
  AND e.reason = 'ready_to_close'
ORDER BY e.escalated_at ASC;

COMMENT ON VIEW agent.pending_human_closures IS 'Fechamentos pendentes de aprovação humana. Painel futuro consome essa view.';
