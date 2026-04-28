-- ============================================================
-- 0015_commerce_views.sql
-- Views derivadas de leitura: preço atual, perfil de cliente.
-- Idempotente: usa CREATE OR REPLACE VIEW.
-- ============================================================

-- ------------------------------------------------------------
-- current_prices — preço válido AGORA por produto
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW commerce.current_prices AS
SELECT DISTINCT ON (environment, product_id)
  environment,
  product_id,
  price_amount,
  currency,
  price_type,
  valid_from,
  valid_until
FROM commerce.product_prices
WHERE valid_from <= now()
  AND (valid_until IS NULL OR valid_until > now())
ORDER BY environment, product_id, price_amount ASC;

COMMENT ON VIEW commerce.current_prices IS 'Preço válido agora por produto. Em sobreposição (ex: regular + promo), vence o menor preço (regra do doc 16). Recomputa a cada SELECT.';

-- ------------------------------------------------------------
-- product_full — produto + spec + preço atual + estoque (visão única)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW commerce.product_full AS
SELECT
  p.id              AS product_id,
  p.environment,
  p.product_code,
  p.product_name,
  p.product_type,
  p.brand,
  p.short_description,
  ts.tire_size,
  ts.width_mm,
  ts.aspect_ratio,
  ts.rim_diameter,
  ts.position       AS tire_position,
  ts.intended_use,
  cp.price_amount,
  cp.currency,
  cp.price_type,
  COALESCE(SUM(sl.quantity_available), 0) AS total_stock_available,
  p.created_at,
  p.updated_at
FROM commerce.products p
LEFT JOIN commerce.tire_specs ts
  ON ts.product_id = p.id AND ts.environment = p.environment
LEFT JOIN commerce.current_prices cp
  ON cp.product_id = p.id AND cp.environment = p.environment
LEFT JOIN commerce.stock_levels sl
  ON sl.product_id = p.id AND sl.environment = p.environment
WHERE p.deleted_at IS NULL
GROUP BY p.id, ts.tire_size, ts.width_mm, ts.aspect_ratio, ts.rim_diameter,
         ts.position, ts.intended_use, cp.price_amount, cp.currency, cp.price_type;

COMMENT ON VIEW commerce.product_full IS 'Visão consolidada produto + spec + preço atual + estoque total. Usada pela skill buscar_e_ofertar.';

-- ------------------------------------------------------------
-- customer_profile — perfil comercial do cliente (a partir de pedidos)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW commerce.customer_profile AS
SELECT
  contact_id,
  environment,
  COUNT(*) FILTER (WHERE status != 'cancelled')                                   AS total_orders,
  SUM(total_amount) FILTER (WHERE status != 'cancelled')                          AS total_spent,
  AVG(total_amount) FILTER (WHERE status != 'cancelled')                          AS avg_ticket,
  MIN(created_at)                                                                  AS first_order_at,
  MAX(created_at)                                                                  AS last_order_at,
  COUNT(DISTINCT geo_resolution_id) FILTER (WHERE status != 'cancelled')          AS distinct_delivery_zones,
  ARRAY_AGG(DISTINCT payment_method) FILTER (WHERE status != 'cancelled' AND payment_method IS NOT NULL) AS used_payment_methods,
  COUNT(*) FILTER (WHERE status = 'cancelled')                                    AS cancelled_orders,
  COUNT(*) FILTER (WHERE status != 'cancelled' AND created_at > now() - interval '90 days') AS orders_last_90d,
  COUNT(*)                                                                         AS total_orders_including_cancelled
FROM commerce.orders
GROUP BY contact_id, environment;

COMMENT ON VIEW commerce.customer_profile IS 'Perfil comercial agregado por contato. Cancelados NÃO entram em total_spent/avg_ticket (apenas em cancelled_orders e total_orders_including_cancelled). Recomputa a cada SELECT — não é tabela. Para dados pesados/diários, fazer mart agregada na Fase E.';

-- ------------------------------------------------------------
-- low_stock_alerts — produtos com estoque baixo
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW commerce.low_stock_alerts AS
SELECT
  p.id              AS product_id,
  p.environment,
  p.product_code,
  p.product_name,
  p.brand,
  ts.tire_size,
  sl.quantity_available,
  sl.location,
  sl.last_adjusted_at
FROM commerce.products p
JOIN commerce.stock_levels sl
  ON sl.product_id = p.id AND sl.environment = p.environment
LEFT JOIN commerce.tire_specs ts
  ON ts.product_id = p.id AND ts.environment = p.environment
WHERE p.deleted_at IS NULL
  AND sl.quantity_available < 5
ORDER BY sl.quantity_available ASC, p.product_name ASC;

COMMENT ON VIEW commerce.low_stock_alerts IS 'Produtos com estoque < 5. Para alerta interno, não exposto ao cliente.';
