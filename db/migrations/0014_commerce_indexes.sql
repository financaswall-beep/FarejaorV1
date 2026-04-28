-- ============================================================
-- 0014_commerce_indexes.sql
-- Índices secundários para busca por nome/marca, fuzzy search, JSON.
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Busca fuzzy em nome de produto (pg_trgm já habilitado em 0001)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS products_name_trgm
  ON commerce.products USING GIN (product_name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS products_brand_trgm
  ON commerce.products USING GIN (brand gin_trgm_ops)
  WHERE deleted_at IS NULL AND brand IS NOT NULL;

-- ------------------------------------------------------------
-- Busca fuzzy em modelo de veículo
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS vehicle_models_make_trgm
  ON commerce.vehicle_models USING GIN (make gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS vehicle_models_model_trgm
  ON commerce.vehicle_models USING GIN (model gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- Busca fuzzy em geo_resolutions
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS geo_neighborhood_trgm
  ON commerce.geo_resolutions USING GIN (neighborhood_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS geo_city_trgm
  ON commerce.geo_resolutions USING GIN (city_name gin_trgm_ops);

-- ------------------------------------------------------------
-- Política em JSON
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS store_policies_value_gin
  ON commerce.store_policies USING GIN (policy_value jsonb_path_ops)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS store_policies_active_idx
  ON commerce.store_policies (policy_key)
  WHERE is_active = true;

-- ------------------------------------------------------------
-- Pedido por data (relatórios)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS orders_created_at_idx
  ON commerce.orders (created_at DESC);

CREATE INDEX IF NOT EXISTS orders_closed_at_idx
  ON commerce.orders (closed_at DESC)
  WHERE closed_at IS NOT NULL;

-- ------------------------------------------------------------
-- Estoque baixo (alertas)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS stock_low_idx
  ON commerce.stock_levels (product_id, quantity_available)
  WHERE quantity_available < 5;

-- ------------------------------------------------------------
-- Comentários
-- ------------------------------------------------------------
COMMENT ON INDEX commerce.products_name_trgm IS 'Busca fuzzy por nome de produto via pg_trgm. Suporta queries tipo "Pirelli 140".';
COMMENT ON INDEX commerce.geo_neighborhood_trgm IS 'Busca fuzzy de bairro. Cobre erros de digitação ("Bonsuceso" vs "Bonsucesso").';
COMMENT ON INDEX commerce.stock_low_idx IS 'Acelera relatório de estoque baixo (< 5 unidades).';
