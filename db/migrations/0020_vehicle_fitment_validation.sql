-- ============================================================
-- 0020_vehicle_fitment_validation.sql
-- Validações finais e helper functions de pesquisa.
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- TRIGGER: vehicle_fitments aceita tire_spec_id apenas de produto type='tire'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION commerce.validate_fitment_product_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_type TEXT;
BEGIN
  SELECT p.product_type INTO v_product_type
  FROM commerce.tire_specs ts
  JOIN commerce.products p ON p.id = ts.product_id
  WHERE ts.id = NEW.tire_spec_id;

  IF v_product_type IS NULL THEN
    RAISE EXCEPTION 'tire_spec_id % not found or has no product', NEW.tire_spec_id;
  END IF;

  IF v_product_type != 'tire' THEN
    RAISE EXCEPTION 'vehicle_fitments.tire_spec_id must reference a product of type=tire (got %)', v_product_type;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_fitment_product_type_trg ON commerce.vehicle_fitments;
CREATE TRIGGER validate_fitment_product_type_trg
  BEFORE INSERT OR UPDATE OF tire_spec_id ON commerce.vehicle_fitments
  FOR EACH ROW
  EXECUTE FUNCTION commerce.validate_fitment_product_type();

-- ------------------------------------------------------------
-- TRIGGER: agent.cart_current_items.product_id deve referenciar produto não deletado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent.validate_cart_item_product()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_at TIMESTAMPTZ;
BEGIN
  SELECT deleted_at INTO v_deleted_at
  FROM commerce.products
  WHERE id = NEW.product_id;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add deleted product % to cart', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_cart_item_product_trg ON agent.cart_current_items;
CREATE TRIGGER validate_cart_item_product_trg
  BEFORE INSERT OR UPDATE OF product_id ON agent.cart_current_items
  FOR EACH ROW
  WHEN (NEW.item_status != 'removed')
  EXECUTE FUNCTION agent.validate_cart_item_product();

-- ------------------------------------------------------------
-- TRIGGER: agent.session_events.event_type deve ter skill_name quando relevante
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent.validate_session_event_skill()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event_type = 'skill_selected' AND (NEW.skill_name IS NULL OR length(trim(NEW.skill_name)) = 0) THEN
    RAISE EXCEPTION 'session_events.skill_name is required when event_type=skill_selected';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_session_event_skill_trg ON agent.session_events;
CREATE TRIGGER validate_session_event_skill_trg
  BEFORE INSERT ON agent.session_events
  FOR EACH ROW
  EXECUTE FUNCTION agent.validate_session_event_skill();

-- ------------------------------------------------------------
-- HELPER: busca de fitments por veículo (resolve via vehicle_fitments + tire_specs + products)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION commerce.find_compatible_tires(
  p_environment      env_t,
  p_vehicle_model_id UUID,
  p_position         TEXT DEFAULT NULL
) RETURNS TABLE (
  product_id        UUID,
  product_name      TEXT,
  brand             TEXT,
  tire_size         TEXT,
  position          TEXT,
  is_oem            BOOLEAN,
  source            TEXT,
  confidence_level  NUMERIC,
  current_price     NUMERIC,
  total_stock       INTEGER
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.product_name,
    p.brand,
    ts.tire_size,
    f.position,
    f.is_oem,
    f.source,
    f.confidence_level,
    cp.price_amount,
    COALESCE(SUM(sl.quantity_available), 0)::INTEGER
  FROM commerce.vehicle_fitments f
  JOIN commerce.tire_specs ts ON ts.id = f.tire_spec_id
  JOIN commerce.products p    ON p.id = ts.product_id AND p.deleted_at IS NULL
  LEFT JOIN commerce.current_prices cp
    ON cp.product_id = p.id AND cp.environment = p.environment
  LEFT JOIN commerce.stock_levels sl
    ON sl.product_id = p.id AND sl.environment = p.environment
  WHERE f.environment = p_environment
    AND f.vehicle_model_id = p_vehicle_model_id
    AND (p_position IS NULL OR f.position = p_position OR f.position = 'both')
  GROUP BY p.id, p.product_name, p.brand, ts.tire_size,
           f.position, f.is_oem, f.source, f.confidence_level, cp.price_amount
  ORDER BY f.is_oem DESC, f.confidence_level DESC NULLS LAST, p.product_name;
$$;

COMMENT ON FUNCTION commerce.find_compatible_tires IS 'Skill buscar_e_ofertar usa esta função. Retorna pneus compatíveis com o veículo, ordenados por OEM > confiança.';

-- ------------------------------------------------------------
-- HELPER: resolver bairro normalizado (fuzzy via aliases ou pg_trgm)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION commerce.resolve_neighborhood(
  p_environment    env_t,
  p_input          TEXT,
  p_city           TEXT DEFAULT NULL,
  p_min_similarity NUMERIC DEFAULT 0.4
) RETURNS TABLE (
  geo_resolution_id UUID,
  neighborhood_canonical TEXT,
  city_name TEXT,
  match_type TEXT,
  similarity NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Match exato
  RETURN QUERY
  SELECT g.id, g.neighborhood_canonical, g.city_name, 'exact'::TEXT, 1.0::NUMERIC
  FROM commerce.geo_resolutions g
  WHERE g.environment = p_environment
    AND lower(g.neighborhood_canonical) = lower(trim(p_input))
    AND (p_city IS NULL OR lower(g.city_name) = lower(trim(p_city)));

  IF FOUND THEN RETURN; END IF;

  -- Match por alias
  RETURN QUERY
  SELECT g.id, g.neighborhood_canonical, g.city_name, 'alias'::TEXT, 0.95::NUMERIC
  FROM commerce.geo_resolutions g
  WHERE g.environment = p_environment
    AND lower(trim(p_input)) = ANY(SELECT lower(unnest(g.aliases)))
    AND (p_city IS NULL OR lower(g.city_name) = lower(trim(p_city)));

  IF FOUND THEN RETURN; END IF;

  -- Fuzzy (pg_trgm) — só se nada exato bateu
  RETURN QUERY
  SELECT g.id, g.neighborhood_canonical, g.city_name, 'fuzzy'::TEXT,
         similarity(g.neighborhood_canonical, p_input)::NUMERIC
  FROM commerce.geo_resolutions g
  WHERE g.environment = p_environment
    AND similarity(g.neighborhood_canonical, p_input) > p_min_similarity
    AND (p_city IS NULL OR lower(g.city_name) = lower(trim(p_city)))
  ORDER BY similarity(g.neighborhood_canonical, p_input) DESC
  LIMIT 5;
END;
$$;

COMMENT ON FUNCTION commerce.resolve_neighborhood IS 'Skill calcular_entrega usa esta função. Resolve bairro mencionado pelo cliente em geo_resolutions canônico, com fallback fuzzy.';

-- ------------------------------------------------------------
-- HELPER: resumo da conversa para escalação humana
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent.build_escalation_summary(
  p_conversation_id UUID,
  p_environment     env_t
) RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_summary TEXT := '';
  v_draft RECORD;
  v_cart_total NUMERIC;
  v_items_text TEXT;
BEGIN
  -- Cabeçalho com slots de checkout
  SELECT customer_name, delivery_address, fulfillment_mode, payment_method
  INTO v_draft
  FROM agent.order_drafts
  WHERE conversation_id = p_conversation_id AND environment = p_environment;

  v_summary := '🛒 CARRINHO PROPOSTO - aguardando fechamento' || E'\n\n';
  v_summary := v_summary || 'Cliente: ' || COALESCE(v_draft.customer_name, '(não informado)') || E'\n';

  -- Itens do carrinho
  SELECT string_agg(
    '  - ' || p.product_name || ' x' || ci.quantity ||
    COALESCE(' - R$ ' || ci.unit_price::TEXT, ''),
    E'\n'
  )
  INTO v_items_text
  FROM agent.cart_current cc
  JOIN agent.cart_current_items ci ON ci.cart_id = cc.id
  JOIN commerce.products p ON p.id = ci.product_id
  WHERE cc.conversation_id = p_conversation_id
    AND cc.environment = p_environment
    AND ci.item_status = 'confirmed';

  v_summary := v_summary || 'Itens:' || E'\n' || COALESCE(v_items_text, '  (nenhum confirmado)') || E'\n';

  -- Total estimado
  SELECT estimated_total INTO v_cart_total
  FROM agent.cart_current
  WHERE conversation_id = p_conversation_id AND environment = p_environment;

  IF v_cart_total IS NOT NULL THEN
    v_summary := v_summary || 'Total estimado: R$ ' || v_cart_total::TEXT || E'\n';
  END IF;

  -- Endereço e modalidade
  v_summary := v_summary || 'Modalidade: ' || COALESCE(v_draft.fulfillment_mode, '(não definida)') || E'\n';
  IF v_draft.fulfillment_mode = 'delivery' THEN
    v_summary := v_summary || 'Endereço: ' || COALESCE(v_draft.delivery_address, '(não informado)') || E'\n';
  END IF;
  v_summary := v_summary || 'Pagamento: ' || COALESCE(v_draft.payment_method, '(não definido)');

  RETURN v_summary;
END;
$$;

COMMENT ON FUNCTION agent.build_escalation_summary IS 'Monta texto formatado para nota interna de escalação. Usado por escalate_to_human action handler.';

-- ------------------------------------------------------------
-- View consolidada: agente_dashboard (operação)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW ops.agent_dashboard AS
SELECT
  'pending_atendente_jobs'::TEXT AS metric,
  COUNT(*)::BIGINT             AS value,
  now()                        AS computed_at
FROM ops.atendente_jobs WHERE status = 'pending'
UNION ALL
SELECT 'processing_atendente_jobs', COUNT(*), now()
FROM ops.atendente_jobs WHERE status = 'processing'
UNION ALL
SELECT 'pending_enrichment_jobs', COUNT(*), now()
FROM ops.enrichment_jobs WHERE status = 'pending'
UNION ALL
SELECT 'unresolved_incidents_high', COUNT(*), now()
FROM ops.agent_incidents WHERE resolved_at IS NULL AND severity IN ('high', 'critical')
UNION ALL
SELECT 'pending_escalations', COUNT(*), now()
FROM agent.escalations WHERE status = 'waiting'
UNION ALL
SELECT 'unreviewed_unhandled', COUNT(*), now()
FROM ops.unhandled_messages WHERE reviewed_at IS NULL;

COMMENT ON VIEW ops.agent_dashboard IS 'Métricas operacionais em tempo real. Healthcheck e dashboard interno consomem.';
