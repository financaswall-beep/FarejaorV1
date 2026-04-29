-- ============================================================
-- 0025_planner_foundation.sql
-- Sprint 3: base deterministica para Planner constrained.
--
-- Aditiva/idempotente:
-- - adiciona event_type planner_decided ao ledger agent.session_events;
-- - adiciona aliases em commerce.vehicle_models para fuzzy matching;
-- - cria commerce.resolve_vehicle_model;
-- - realinha helper functions para nomes canonicos usados no banco vivo:
--   fitment_position, fitment_source, match_similarity.
-- ============================================================

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
    'intent_to_close_recorded',

    -- Sprint 3 Planner
    'planner_decided'
  ));

ALTER TABLE commerce.vehicle_models
  ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS vehicle_models_aliases_gin
  ON commerce.vehicle_models USING GIN (aliases);

-- Drop antes de recriar porque RETURNS TABLE faz parte da assinatura efetiva.
DROP FUNCTION IF EXISTS commerce.find_compatible_tires(env_t, uuid, text);

CREATE OR REPLACE FUNCTION commerce.find_compatible_tires(
  p_environment      env_t,
  p_vehicle_model_id UUID,
  p_position         TEXT DEFAULT NULL
) RETURNS TABLE (
  product_id        UUID,
  product_name      TEXT,
  brand             TEXT,
  tire_size         TEXT,
  fitment_position  TEXT,
  is_oem            BOOLEAN,
  fitment_source    TEXT,
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
    f.position AS fitment_position,
    f.is_oem,
    f.source AS fitment_source,
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

COMMENT ON FUNCTION commerce.find_compatible_tires IS 'Skill buscar_e_ofertar usa esta funcao. Retorna pneus compativeis com nomes canonicos fitment_position/fitment_source.';

DROP FUNCTION IF EXISTS commerce.resolve_neighborhood(env_t, text, text, numeric);

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
  match_similarity NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.neighborhood_canonical, g.city_name, 'exact'::TEXT, 1.0::NUMERIC
  FROM commerce.geo_resolutions g
  WHERE g.environment = p_environment
    AND lower(g.neighborhood_canonical) = lower(trim(p_input))
    AND (p_city IS NULL OR lower(g.city_name) = lower(trim(p_city)));

  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT g.id, g.neighborhood_canonical, g.city_name, 'alias'::TEXT, 0.95::NUMERIC
  FROM commerce.geo_resolutions g
  WHERE g.environment = p_environment
    AND lower(trim(p_input)) = ANY(SELECT lower(unnest(g.aliases)))
    AND (p_city IS NULL OR lower(g.city_name) = lower(trim(p_city)));

  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT g.id, g.neighborhood_canonical, g.city_name, 'fuzzy'::TEXT,
         similarity(g.neighborhood_canonical, p_input)::NUMERIC AS match_similarity
  FROM commerce.geo_resolutions g
  WHERE g.environment = p_environment
    AND similarity(g.neighborhood_canonical, p_input) > p_min_similarity
    AND (p_city IS NULL OR lower(g.city_name) = lower(trim(p_city)))
  ORDER BY similarity(g.neighborhood_canonical, p_input) DESC
  LIMIT 5;
END;
$$;

COMMENT ON FUNCTION commerce.resolve_neighborhood IS 'Resolve bairro mencionado pelo cliente com match_similarity canonico.';

CREATE OR REPLACE FUNCTION commerce.resolve_vehicle_model(
  p_environment    env_t,
  p_input          TEXT,
  p_year           INTEGER DEFAULT NULL,
  p_min_similarity NUMERIC DEFAULT 0.5
) RETURNS TABLE (
  vehicle_model_id UUID,
  make TEXT,
  model TEXT,
  variant TEXT,
  year_start INTEGER,
  year_end INTEGER,
  displacement_cc INTEGER,
  match_type TEXT,
  match_similarity NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.make, v.model, v.variant, v.year_start, v.year_end,
         v.displacement_cc, 'exact'::TEXT, 1.0::NUMERIC
  FROM commerce.vehicle_models v
  WHERE v.environment = p_environment
    AND v.deleted_at IS NULL
    AND lower(v.model) = lower(trim(p_input))
    AND (p_year IS NULL OR v.year_start IS NULL OR v.year_start <= p_year)
    AND (p_year IS NULL OR v.year_end IS NULL OR v.year_end >= p_year)
  ORDER BY v.year_start DESC NULLS LAST, v.model ASC
  LIMIT 5;

  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT v.id, v.make, v.model, v.variant, v.year_start, v.year_end,
         v.displacement_cc, 'alias'::TEXT, 0.95::NUMERIC
  FROM commerce.vehicle_models v
  WHERE v.environment = p_environment
    AND v.deleted_at IS NULL
    AND lower(trim(p_input)) = ANY(SELECT lower(unnest(v.aliases)))
    AND (p_year IS NULL OR v.year_start IS NULL OR v.year_start <= p_year)
    AND (p_year IS NULL OR v.year_end IS NULL OR v.year_end >= p_year)
  ORDER BY v.year_start DESC NULLS LAST, v.model ASC
  LIMIT 5;

  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT v.id, v.make, v.model, v.variant, v.year_start, v.year_end,
         v.displacement_cc, 'fuzzy'::TEXT,
         GREATEST(
           similarity(v.model, p_input),
           similarity(v.make || ' ' || v.model || COALESCE(' ' || v.variant, ''), p_input)
         )::NUMERIC AS match_similarity
  FROM commerce.vehicle_models v
  WHERE v.environment = p_environment
    AND v.deleted_at IS NULL
    AND (
      similarity(v.model, p_input) > p_min_similarity
      OR similarity(v.make || ' ' || v.model || COALESCE(' ' || v.variant, ''), p_input) > p_min_similarity
    )
    AND (p_year IS NULL OR v.year_start IS NULL OR v.year_start <= p_year)
    AND (p_year IS NULL OR v.year_end IS NULL OR v.year_end >= p_year)
  ORDER BY match_similarity DESC, v.year_start DESC NULLS LAST, v.model ASC
  LIMIT 5;
END;
$$;

COMMENT ON FUNCTION commerce.resolve_vehicle_model IS 'Resolve modelo de veiculo por match exato, alias ou pg_trgm; usado pelo Planner/Atendente antes de compatibilidade.';
