-- ============================================================
-- 0017_agent_triggers.sql
-- Triggers de validação cruzada e regras que CHECK não cobre.
-- Idempotente: DROP IF EXISTS antes de CREATE.
-- ============================================================

-- ------------------------------------------------------------
-- FK lógica fitment_discoveries.evidence_conversation_id
-- (não criada inline em 0013 para evitar dependência circular)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fitment_discoveries_evidence_conv_fk'
  ) THEN
    ALTER TABLE commerce.fitment_discoveries
      ADD CONSTRAINT fitment_discoveries_evidence_conv_fk
      FOREIGN KEY (evidence_conversation_id) REFERENCES core.conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- TRIGGER: vehicle_fitments.position vs vehicle_models.vehicle_type
-- Motorcycle/car aceitam combinações diferentes de position.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION commerce.validate_fitment_position()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT vehicle_type INTO v_type
  FROM commerce.vehicle_models
  WHERE id = NEW.vehicle_model_id;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'vehicle_model_id % not found', NEW.vehicle_model_id;
  END IF;

  -- Motorcycle: front, rear, both são todos válidos
  IF v_type = 'motorcycle' AND NEW.position IN ('front', 'rear', 'both') THEN
    RETURN NEW;
  END IF;

  -- Car: front, rear, both também válidos (eixos)
  IF v_type = 'car' AND NEW.position IN ('front', 'rear', 'both') THEN
    RETURN NEW;
  END IF;

  -- Truck: idem
  IF v_type = 'truck' AND NEW.position IN ('front', 'rear', 'both') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid position % for vehicle_type %', NEW.position, v_type;
END;
$$;

DROP TRIGGER IF EXISTS validate_fitment_position_trg ON commerce.vehicle_fitments;
CREATE TRIGGER validate_fitment_position_trg
  BEFORE INSERT OR UPDATE OF position, vehicle_model_id ON commerce.vehicle_fitments
  FOR EACH ROW
  EXECUTE FUNCTION commerce.validate_fitment_position();

COMMENT ON FUNCTION commerce.validate_fitment_position() IS 'Bloqueia position incompatível com vehicle_type. CHECK constraint não funciona com subselect.';

-- ------------------------------------------------------------
-- TRIGGER: fitment_discoveries.position igual ao da promoção
-- Se promoted_to_fitment_id está setado, position deve bater.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION commerce.validate_discovery_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_promoted_position TEXT;
BEGIN
  IF NEW.promoted_to_fitment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT position INTO v_promoted_position
  FROM commerce.vehicle_fitments
  WHERE id = NEW.promoted_to_fitment_id;

  IF v_promoted_position IS NULL THEN
    RAISE EXCEPTION 'promoted_to_fitment_id % not found', NEW.promoted_to_fitment_id;
  END IF;

  IF v_promoted_position != NEW.position THEN
    RAISE EXCEPTION 'Discovery position % does not match promoted fitment position %', NEW.position, v_promoted_position;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_discovery_promotion_trg ON commerce.fitment_discoveries;
CREATE TRIGGER validate_discovery_promotion_trg
  BEFORE INSERT OR UPDATE OF promoted_to_fitment_id ON commerce.fitment_discoveries
  FOR EACH ROW
  EXECUTE FUNCTION commerce.validate_discovery_promotion();

-- ------------------------------------------------------------
-- TRIGGER: agent.cart_current.cart_status = 'promoted' exige todos os itens 'confirmed'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent.validate_cart_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_unconfirmed_count INTEGER;
BEGIN
  IF NEW.cart_status != 'promoted' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_unconfirmed_count
  FROM agent.cart_current_items
  WHERE cart_id = NEW.id
    AND item_status NOT IN ('confirmed');

  IF v_unconfirmed_count > 0 THEN
    RAISE EXCEPTION 'Cart cannot be promoted: % itens not confirmed', v_unconfirmed_count;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_cart_promotion_trg ON agent.cart_current;
CREATE TRIGGER validate_cart_promotion_trg
  BEFORE UPDATE OF cart_status ON agent.cart_current
  FOR EACH ROW
  WHEN (NEW.cart_status = 'promoted')
  EXECUTE FUNCTION agent.validate_cart_promotion();

-- ------------------------------------------------------------
-- TRIGGER: order_drafts.promoted_order_id deve apontar para conversation correta
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent.validate_draft_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_conv_id UUID;
BEGIN
  IF NEW.promoted_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT source_conversation_id INTO v_order_conv_id
  FROM commerce.orders
  WHERE id = NEW.promoted_order_id;

  -- Se source_conversation_id é NULL no order, ok (pedido manual sem origem)
  IF v_order_conv_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_order_conv_id != NEW.conversation_id THEN
    RAISE EXCEPTION 'Draft conversation % does not match promoted order conversation %',
      NEW.conversation_id, v_order_conv_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_draft_promotion_trg ON agent.order_drafts;
CREATE TRIGGER validate_draft_promotion_trg
  BEFORE INSERT OR UPDATE OF promoted_order_id ON agent.order_drafts
  FOR EACH ROW
  EXECUTE FUNCTION agent.validate_draft_promotion();

-- ------------------------------------------------------------
-- TRIGGER: updated_at automático em tabelas mutáveis
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- agent.session_current
DROP TRIGGER IF EXISTS session_current_set_updated_at ON agent.session_current;
CREATE TRIGGER session_current_set_updated_at
  BEFORE UPDATE ON agent.session_current
  FOR EACH ROW EXECUTE FUNCTION agent.set_updated_at();

-- agent.cart_current
DROP TRIGGER IF EXISTS cart_current_set_updated_at ON agent.cart_current;
CREATE TRIGGER cart_current_set_updated_at
  BEFORE UPDATE ON agent.cart_current
  FOR EACH ROW EXECUTE FUNCTION agent.set_updated_at();

-- agent.cart_current_items
DROP TRIGGER IF EXISTS cart_items_set_updated_at ON agent.cart_current_items;
CREATE TRIGGER cart_items_set_updated_at
  BEFORE UPDATE ON agent.cart_current_items
  FOR EACH ROW EXECUTE FUNCTION agent.set_updated_at();

-- agent.order_drafts
DROP TRIGGER IF EXISTS order_drafts_set_updated_at ON agent.order_drafts;
CREATE TRIGGER order_drafts_set_updated_at
  BEFORE UPDATE ON agent.order_drafts
  FOR EACH ROW EXECUTE FUNCTION agent.set_updated_at();

-- ------------------------------------------------------------
-- TRIGGER: bloquear UPDATE em session_events (append-only)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent.enforce_session_events_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'agent.session_events is append-only. UPDATE/DELETE blocked.';
END;
$$;

DROP TRIGGER IF EXISTS session_events_immutable_trg ON agent.session_events;
CREATE TRIGGER session_events_immutable_trg
  BEFORE UPDATE OR DELETE ON agent.session_events
  FOR EACH ROW EXECUTE FUNCTION agent.enforce_session_events_immutability();

-- ------------------------------------------------------------
-- TRIGGER: bloquear UPDATE em cart_events (append-only)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS cart_events_immutable_trg ON agent.cart_events;
CREATE TRIGGER cart_events_immutable_trg
  BEFORE UPDATE OR DELETE ON agent.cart_events
  FOR EACH ROW EXECUTE FUNCTION agent.enforce_session_events_immutability();

-- ------------------------------------------------------------
-- Comentários finais
-- ------------------------------------------------------------
COMMENT ON FUNCTION agent.set_updated_at() IS 'Atualiza coluna updated_at em qualquer tabela. Reusável.';
COMMENT ON FUNCTION agent.enforce_session_events_immutability() IS 'Bloqueia UPDATE/DELETE em tabelas append-only.';
