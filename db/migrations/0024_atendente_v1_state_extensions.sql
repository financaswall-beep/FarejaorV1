-- ============================================================
-- 0024 - Extensoes aditivas em agent.* para Atendente v1.
--
-- Mantem intacto o schema relacional criado em 0016_agent_layer.sql.
-- Adiciona apenas o necessario para estado reentrante:
-- - version/turn_index em session_current
-- - action_id/turn_index/resulting_state_version em session_events
-- - novos event_type fechados por CHECK
-- - session_items: interesses em discussao antes do carrinho
-- - session_slots: slots com procedencia e stale flags
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. session_current: optimistic lock + bookkeeping
-- ------------------------------------------------------------

ALTER TABLE agent.session_current
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turn_index INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS session_current_conv_version_idx
  ON agent.session_current (conversation_id, version);

COMMENT ON COLUMN agent.session_current.version IS
  'Versao otimista do snapshot da sessao. ActionHandler faz UPDATE com version esperada.';

COMMENT ON COLUMN agent.session_current.turn_index IS
  'Indice monotono do turno da Atendente nesta conversa.';

-- ------------------------------------------------------------
-- B. session_events: idempotencia por action + versao resultante
-- ------------------------------------------------------------

ALTER TABLE agent.session_events
  ADD COLUMN IF NOT EXISTS action_id UUID,
  ADD COLUMN IF NOT EXISTS turn_index INTEGER,
  ADD COLUMN IF NOT EXISTS resulting_state_version BIGINT,
  ADD COLUMN IF NOT EXISTS emitted_by TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_events_action_id_unique'
      AND conrelid = 'agent.session_events'::regclass
  ) THEN
    ALTER TABLE agent.session_events
      ADD CONSTRAINT session_events_action_id_unique UNIQUE (action_id);
  END IF;
END $$;

ALTER TABLE agent.session_events
  DROP CONSTRAINT IF EXISTS session_events_emitted_by_check;

ALTER TABLE agent.session_events
  ADD CONSTRAINT session_events_emitted_by_check
  CHECK (emitted_by IS NULL OR emitted_by IN ('generator', 'system', 'human_override'));

ALTER TABLE agent.session_events
  DROP CONSTRAINT IF EXISTS session_events_event_type_check;

ALTER TABLE agent.session_events
  ADD CONSTRAINT session_events_event_type_check
  CHECK (event_type IN (
    -- 0016 original event types
    'skill_selected',
    'confirmation_requested',
    'cart_proposed',
    'human_called',
    'bot_resumed',
    'session_paused',
    'session_closed',
    'fact_corrected',
    'escalation_created',

    -- Atendente v1 reentrante
    'slot_set',
    'slot_marked_stale',
    'item_created',
    'active_item_changed',
    'item_status_changed',
    'offer_made',
    'offer_invalidated',
    'objection_raised',
    'human_requested',
    'unsupported_observation',
    'intent_to_close_recorded'
  ));

CREATE INDEX IF NOT EXISTS session_events_action_idx
  ON agent.session_events (action_id)
  WHERE action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS session_events_conv_turn_idx
  ON agent.session_events (conversation_id, turn_index, occurred_at DESC)
  WHERE turn_index IS NOT NULL;

COMMENT ON COLUMN agent.session_events.action_id IS
  'UUID da action aplicada. UNIQUE quando presente para garantir idempotencia em retry.';

COMMENT ON COLUMN agent.session_events.resulting_state_version IS
  'Versao de agent.session_current apos aplicar esta action.';

-- ------------------------------------------------------------
-- C. session_items: interesses em discussao antes do carrinho
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent.session_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment     env_t       NOT NULL,
  conversation_id UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'aberto'
                  CHECK (status IN ('aberto', 'ofertado', 'no_carrinho', 'descartado')),
  is_active       BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent.session_items IS
  'Interesses em discussao (uma moto + pneu buscado). Diferente de cart_current_items: ainda nao esta no carrinho.';

CREATE UNIQUE INDEX IF NOT EXISTS session_items_one_active_per_conv
  ON agent.session_items (conversation_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS session_items_conv_status_idx
  ON agent.session_items (environment, conversation_id, status);

DROP TRIGGER IF EXISTS session_items_set_updated_at ON agent.session_items;
CREATE TRIGGER session_items_set_updated_at
  BEFORE UPDATE ON agent.session_items
  FOR EACH ROW EXECUTE FUNCTION agent.set_updated_at();

-- ------------------------------------------------------------
-- D. session_slots: slots com procedencia
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent.session_slots (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment            env_t       NOT NULL,
  conversation_id        UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  scope                  TEXT        NOT NULL CHECK (scope IN ('global', 'item')),
  item_id                UUID        REFERENCES agent.session_items(id) ON DELETE CASCADE,
  slot_key               TEXT        NOT NULL,
  value_json             JSONB       NOT NULL,
  source                 TEXT        NOT NULL CHECK (source IN (
                           'observed',
                           'inferred',
                           'confirmed',
                           'offered_to_client',
                           'inferred_from_history',
                           'inferred_from_organizadora'
                         )),
  confidence             NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  stale                  TEXT        NOT NULL DEFAULT 'fresh' CHECK (stale IN ('fresh', 'stale', 'stale_strong')),
  requires_confirmation  BOOLEAN     NOT NULL DEFAULT false,
  evidence_text          TEXT,
  set_by_message_id      UUID,
  set_by_skill           TEXT,
  previous_value_json    JSONB,
  set_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'global' AND item_id IS NULL)
    OR
    (scope = 'item' AND item_id IS NOT NULL)
  )
);

COMMENT ON TABLE agent.session_slots IS
  'Slots da Atendente com procedencia. Um row = um slot ativo. Historico completo fica em session_events.';

CREATE UNIQUE INDEX IF NOT EXISTS session_slots_unique_per_key
  ON agent.session_slots (
    environment,
    conversation_id,
    scope,
    COALESCE(item_id, '00000000-0000-0000-0000-000000000000'::uuid),
    slot_key
  );

CREATE INDEX IF NOT EXISTS session_slots_stale_idx
  ON agent.session_slots (environment, stale)
  WHERE stale != 'fresh';

CREATE INDEX IF NOT EXISTS session_slots_conv_scope_idx
  ON agent.session_slots (environment, conversation_id, scope);

DROP TRIGGER IF EXISTS session_slots_set_updated_at ON agent.session_slots;
CREATE TRIGGER session_slots_set_updated_at
  BEFORE UPDATE ON agent.session_slots
  FOR EACH ROW EXECUTE FUNCTION agent.set_updated_at();

-- ------------------------------------------------------------
-- E. env_match guards para as novas tabelas
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION agent.session_items_env_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conv_env env_t;
BEGIN
  SELECT environment INTO conv_env
  FROM core.conversations
  WHERE id = NEW.conversation_id;

  IF conv_env IS NULL THEN
    RAISE EXCEPTION 'conversation_id % not found', NEW.conversation_id;
  END IF;

  IF conv_env <> NEW.environment THEN
    RAISE EXCEPTION 'env mismatch in session_items: % vs conversations.%', NEW.environment, conv_env;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_items_env_match ON agent.session_items;
CREATE TRIGGER trg_session_items_env_match
  BEFORE INSERT OR UPDATE OF environment, conversation_id ON agent.session_items
  FOR EACH ROW EXECUTE FUNCTION agent.session_items_env_match();

CREATE OR REPLACE FUNCTION agent.session_slots_env_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conv_env env_t;
  item_env env_t;
BEGIN
  SELECT environment INTO conv_env
  FROM core.conversations
  WHERE id = NEW.conversation_id;

  IF conv_env IS NULL THEN
    RAISE EXCEPTION 'conversation_id % not found', NEW.conversation_id;
  END IF;

  IF conv_env <> NEW.environment THEN
    RAISE EXCEPTION 'env mismatch in session_slots: % vs conversations.%', NEW.environment, conv_env;
  END IF;

  IF NEW.item_id IS NOT NULL THEN
    SELECT environment INTO item_env
    FROM agent.session_items
    WHERE id = NEW.item_id;

    IF item_env IS NULL THEN
      RAISE EXCEPTION 'item_id % not found', NEW.item_id;
    END IF;

    IF item_env <> NEW.environment THEN
      RAISE EXCEPTION 'env mismatch in session_slots item: % vs item.%', NEW.environment, item_env;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_slots_env_match ON agent.session_slots;
CREATE TRIGGER trg_session_slots_env_match
  BEFORE INSERT OR UPDATE OF environment, conversation_id, item_id ON agent.session_slots
  FOR EACH ROW EXECUTE FUNCTION agent.session_slots_env_match();

-- environment imutavel nas novas tabelas
DROP TRIGGER IF EXISTS env_immutable_session_items ON agent.session_items;
CREATE TRIGGER env_immutable_session_items
  BEFORE UPDATE OF environment ON agent.session_items
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_session_slots ON agent.session_slots;
CREATE TRIGGER env_immutable_session_slots
  BEFORE UPDATE OF environment ON agent.session_slots
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

COMMIT;
