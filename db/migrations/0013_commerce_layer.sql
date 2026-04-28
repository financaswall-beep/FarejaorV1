-- ============================================================
-- 0013_commerce_layer.sql
-- Camada COMMERCE: catálogo, fitments, estoque, preços, pedidos.
-- Schema novo na Fase 3.
-- Idempotente: roda várias vezes sem quebrar.
-- ============================================================

-- Schema
CREATE SCHEMA IF NOT EXISTS commerce;

COMMENT ON SCHEMA commerce IS 'Catálogo da loja, compatibilidades veículo-pneu, estoque, preços, pedidos confirmados. Verdade comercial — vai para fiscal/relatório de venda.';

-- ------------------------------------------------------------
-- products — cabeçalho do item vendável
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         env_t       NOT NULL,
  product_code        TEXT        NOT NULL,
  product_name        TEXT        NOT NULL,
  product_type        TEXT        NOT NULL CHECK (product_type IN ('tire', 'tube', 'valve', 'oil', 'accessory', 'service')),
  brand               TEXT,
  short_description   TEXT,
  internal_notes      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  UNIQUE (environment, product_code)
);

COMMENT ON TABLE commerce.products IS 'Cabeçalho de cada item vendável. Não guarda preço, estoque, foto ou compatibilidade — esses ficam em tabelas separadas.';
COMMENT ON COLUMN commerce.products.internal_notes IS 'Observações internas. NUNCA mostrar ao cliente — Say Validator deve barrar.';
COMMENT ON COLUMN commerce.products.deleted_at IS 'Soft delete. Produto não aparece mais para venda, mas histórico de pedidos antigos continua válido.';

CREATE INDEX IF NOT EXISTS products_brand_idx ON commerce.products (brand) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS products_type_idx ON commerce.products (product_type) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- tire_specs — especificação técnica do pneu
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.tire_specs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment       env_t       NOT NULL,
  product_id        UUID        NOT NULL REFERENCES commerce.products(id) ON DELETE CASCADE,
  tire_size         TEXT        NOT NULL,
  width_mm          INTEGER,
  aspect_ratio      INTEGER,
  rim_diameter      INTEGER,
  load_index        TEXT,
  speed_rating      TEXT,
  construction      TEXT CHECK (construction IN ('radial', 'bias') OR construction IS NULL),
  tread_pattern     TEXT,
  intended_use      TEXT CHECK (intended_use IN ('street', 'offroad', 'mixed', 'track') OR intended_use IS NULL),
  position          TEXT CHECK (position IN ('front', 'rear', 'both') OR position IS NULL),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, product_id)
);

COMMENT ON TABLE commerce.tire_specs IS 'Especificação técnica do pneu. Um produto-pneu tem um spec.';
COMMENT ON COLUMN commerce.tire_specs.tire_size IS 'Medida nominal no formato 140/70-17. Validação de formato no repositório TypeScript.';

CREATE INDEX IF NOT EXISTS tire_specs_size_idx ON commerce.tire_specs (tire_size);
CREATE INDEX IF NOT EXISTS tire_specs_dim_idx ON commerce.tire_specs (width_mm, aspect_ratio, rim_diameter);

-- ------------------------------------------------------------
-- vehicle_models — modelos de moto/carro/caminhão
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.vehicle_models (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment       env_t       NOT NULL,
  vehicle_type      TEXT        NOT NULL CHECK (vehicle_type IN ('motorcycle', 'car', 'truck')),
  make              TEXT        NOT NULL,
  model             TEXT        NOT NULL,
  variant           TEXT,
  year_start        INTEGER,
  year_end          INTEGER,
  displacement_cc   INTEGER,
  segment           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (environment, vehicle_type, make, model, variant, year_start)
);

COMMENT ON TABLE commerce.vehicle_models IS 'Modelos de veículo. Inicialmente moto; carro/caminhão entram em fase futura sem mudança de schema.';
COMMENT ON COLUMN commerce.vehicle_models.segment IS 'Segmento livre por enquanto (TEXT). Promove a CHECK depois de 4-8 semanas: naked, sport, commuter, offroad, scooter, etc.';

CREATE INDEX IF NOT EXISTS vehicle_models_make_model_idx ON commerce.vehicle_models (make, model) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vehicle_models_type_idx ON commerce.vehicle_models (vehicle_type) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- vehicle_fitments — compatibilidade veículo + pneu
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.vehicle_fitments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         env_t       NOT NULL,
  vehicle_model_id    UUID        NOT NULL REFERENCES commerce.vehicle_models(id) ON DELETE CASCADE,
  tire_spec_id        UUID        NOT NULL REFERENCES commerce.tire_specs(id) ON DELETE CASCADE,
  position            TEXT        NOT NULL CHECK (position IN ('front', 'rear', 'both')),
  is_oem              BOOLEAN     NOT NULL DEFAULT false,
  source              TEXT        NOT NULL CHECK (source IN ('manufacturer', 'manual', 'discovery_promoted')),
  confidence_level    NUMERIC(3, 2) CHECK (confidence_level BETWEEN 0 AND 1),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, vehicle_model_id, tire_spec_id, position)
);

COMMENT ON TABLE commerce.vehicle_fitments IS 'Compatibilidade entre veículo e pneu. Validação cruzada de position vs vehicle_type via trigger (0017).';
COMMENT ON COLUMN commerce.vehicle_fitments.is_oem IS 'TRUE se for medida de fábrica.';
COMMENT ON COLUMN commerce.vehicle_fitments.source IS 'manufacturer (catálogo oficial), manual (importado por planilha), discovery_promoted (descoberto pela conversa e aprovado).';

CREATE INDEX IF NOT EXISTS fitments_vehicle_idx ON commerce.vehicle_fitments (vehicle_model_id);
CREATE INDEX IF NOT EXISTS fitments_tire_idx ON commerce.vehicle_fitments (tire_spec_id);

-- ------------------------------------------------------------
-- product_media — fotos e vídeos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.product_media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment   env_t       NOT NULL,
  product_id    UUID        NOT NULL REFERENCES commerce.products(id) ON DELETE CASCADE,
  media_url     TEXT        NOT NULL,
  media_type    TEXT        NOT NULL CHECK (media_type IN ('image', 'video', 'document')),
  display_order INTEGER     NOT NULL DEFAULT 0,
  caption       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE commerce.product_media IS 'Fotos, vídeos e documentos associados ao produto.';

CREATE INDEX IF NOT EXISTS product_media_product_idx ON commerce.product_media (product_id, display_order);

-- ------------------------------------------------------------
-- stock_levels — quantidade disponível
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.stock_levels (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment           env_t       NOT NULL,
  product_id            UUID        NOT NULL REFERENCES commerce.products(id),
  quantity_available    INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  quantity_reserved     INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  location              TEXT        NOT NULL DEFAULT 'main',
  last_adjusted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, product_id, location)
);

COMMENT ON TABLE commerce.stock_levels IS 'Quantidade disponível por produto e local. Reserva é uso futuro (v2 transacional).';

CREATE INDEX IF NOT EXISTS stock_product_idx ON commerce.stock_levels (product_id);

-- ------------------------------------------------------------
-- product_prices — preço com validade temporal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.product_prices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment   env_t       NOT NULL,
  product_id    UUID        NOT NULL REFERENCES commerce.products(id),
  price_amount  NUMERIC(10, 2) NOT NULL CHECK (price_amount >= 0),
  currency      TEXT        NOT NULL DEFAULT 'BRL',
  valid_from    TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until   TIMESTAMPTZ,
  price_type    TEXT        NOT NULL DEFAULT 'regular' CHECK (price_type IN ('regular', 'promo', 'wholesale')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

COMMENT ON TABLE commerce.product_prices IS 'Preço com janela de validade. Permite promoção sem perder histórico.';

CREATE INDEX IF NOT EXISTS prices_product_active_idx ON commerce.product_prices (product_id, valid_from DESC, valid_until DESC NULLS FIRST);

-- ------------------------------------------------------------
-- geo_resolutions — bairros e municípios normalizados
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.geo_resolutions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment              env_t       NOT NULL,
  neighborhood_name        TEXT        NOT NULL,
  neighborhood_canonical   TEXT        NOT NULL,
  city_name                TEXT        NOT NULL,
  state_code               TEXT        NOT NULL,
  postal_code_prefix       TEXT,
  aliases                  TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, neighborhood_canonical, city_name, state_code)
);

COMMENT ON TABLE commerce.geo_resolutions IS 'Bairros e municípios normalizados. "Bonsuceso" e "Bonsucesso" viram a mesma linha via aliases.';

CREATE INDEX IF NOT EXISTS geo_canonical_idx ON commerce.geo_resolutions (neighborhood_canonical, city_name);
CREATE INDEX IF NOT EXISTS geo_aliases_gin ON commerce.geo_resolutions USING GIN (aliases);

-- ------------------------------------------------------------
-- delivery_zones — taxa e prazo por bairro
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.delivery_zones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         env_t       NOT NULL,
  geo_resolution_id   UUID        NOT NULL REFERENCES commerce.geo_resolutions(id) ON DELETE CASCADE,
  delivery_fee        NUMERIC(8, 2) NOT NULL CHECK (delivery_fee >= 0),
  delivery_days       SMALLINT    NOT NULL CHECK (delivery_days >= 0),
  is_available        BOOLEAN     NOT NULL DEFAULT true,
  delivery_mode       TEXT        NOT NULL DEFAULT 'own_fleet' CHECK (delivery_mode IN ('own_fleet', 'partner', 'pickup_only')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, geo_resolution_id, delivery_mode)
);

COMMENT ON TABLE commerce.delivery_zones IS 'Taxa, prazo e modalidade por bairro. is_available=false bloqueia entrega.';

CREATE INDEX IF NOT EXISTS delivery_zones_geo_idx ON commerce.delivery_zones (geo_resolution_id);

-- ------------------------------------------------------------
-- store_policies — políticas em chave/valor
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.store_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment     env_t       NOT NULL,
  policy_key      TEXT        NOT NULL,
  policy_value    JSONB       NOT NULL,
  description     TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  policy_version  TEXT        NOT NULL DEFAULT 'v1',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, policy_key, policy_version)
);

COMMENT ON TABLE commerce.store_policies IS 'Políticas da loja. Ex: prazo_garantia_pneus, formas_pagamento_aceitas, valor_minimo_entrega.';

-- ------------------------------------------------------------
-- import_batches — controle de importação por planilha
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment     env_t       NOT NULL,
  source_file     TEXT        NOT NULL,
  import_type     TEXT        NOT NULL CHECK (import_type IN ('products', 'vehicles', 'fitments', 'prices', 'stock', 'geo')),
  total_rows      INTEGER     NOT NULL DEFAULT 0,
  processed_rows  INTEGER     NOT NULL DEFAULT 0,
  failed_rows     INTEGER     NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE commerce.import_batches IS 'Controle de importação CSV/planilha. Cada importação gera um batch.';

-- ------------------------------------------------------------
-- import_errors — linhas com erro
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.import_errors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment     env_t       NOT NULL,
  import_batch_id UUID        NOT NULL REFERENCES commerce.import_batches(id) ON DELETE CASCADE,
  row_number      INTEGER     NOT NULL,
  column_name     TEXT,
  raw_value       TEXT,
  error_message   TEXT        NOT NULL,
  action_taken    TEXT        NOT NULL CHECK (action_taken IN ('skipped', 'defaulted', 'manual_review')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE commerce.import_errors IS 'Linhas que falharam na importação. action_taken indica o que o sistema fez.';

CREATE INDEX IF NOT EXISTS import_errors_batch_idx ON commerce.import_errors (import_batch_id);

-- ------------------------------------------------------------
-- fitment_discoveries — compatibilidades descobertas em conversa
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.fitment_discoveries (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment                 env_t       NOT NULL,
  vehicle_model_id            UUID        NOT NULL REFERENCES commerce.vehicle_models(id),
  tire_spec_id                UUID        NOT NULL REFERENCES commerce.tire_specs(id),
  position                    TEXT        NOT NULL CHECK (position IN ('front', 'rear', 'both')),
  status                      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'promoted')),
  evidence_conversation_id    UUID,  -- FK lógica para core.conversations(id), criada em 0017_agent_triggers
  discovered_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by                 TEXT,
  reviewed_at                 TIMESTAMPTZ,
  promoted_to_fitment_id      UUID REFERENCES commerce.vehicle_fitments(id),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status != 'promoted' OR promoted_to_fitment_id IS NOT NULL),
  CHECK (status NOT IN ('approved', 'rejected', 'promoted') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

COMMENT ON TABLE commerce.fitment_discoveries IS 'Compatibilidades sugeridas durante conversa. Só vira vehicle_fitment oficial após aprovação humana.';
COMMENT ON COLUMN commerce.fitment_discoveries.evidence_conversation_id IS 'Conversa em core.conversations onde a descoberta foi sinalizada.';

CREATE INDEX IF NOT EXISTS discoveries_status_idx ON commerce.fitment_discoveries (status) WHERE status IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS discoveries_vehicle_idx ON commerce.fitment_discoveries (vehicle_model_id);

-- ------------------------------------------------------------
-- orders — pedido confirmado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.orders (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment              env_t       NOT NULL,
  contact_id               UUID        NOT NULL REFERENCES core.contacts(id),
  source_conversation_id   UUID        REFERENCES core.conversations(id),
  total_amount             NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  status                   TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'delivered', 'cancelled')),
  fulfillment_mode         TEXT        NOT NULL CHECK (fulfillment_mode IN ('delivery', 'pickup')),
  payment_method           TEXT,
  delivery_address         TEXT,
  geo_resolution_id        UUID        REFERENCES commerce.geo_resolutions(id),
  closed_by                TEXT,
  closed_at                TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fulfillment_mode != 'delivery' OR delivery_address IS NOT NULL)
);

COMMENT ON TABLE commerce.orders IS 'Pedido confirmado. Só nasce quando humano fecha (v1) ou transação automática fecha (v2). Verdade comercial.';

CREATE INDEX IF NOT EXISTS orders_contact_idx ON commerce.orders (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON commerce.orders (status) WHERE status IN ('open', 'paid');
CREATE INDEX IF NOT EXISTS orders_conv_idx ON commerce.orders (source_conversation_id) WHERE source_conversation_id IS NOT NULL;

-- ------------------------------------------------------------
-- order_items — itens do pedido confirmado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce.order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment       env_t       NOT NULL,
  order_id          UUID        NOT NULL REFERENCES commerce.orders(id) ON DELETE CASCADE,
  product_id        UUID        NOT NULL REFERENCES commerce.products(id),
  quantity          INTEGER     NOT NULL CHECK (quantity > 0),
  unit_price        NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  discount_amount   NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE commerce.order_items IS 'Itens do pedido confirmado. unit_price congelado no fechamento (não acompanha mudança de product_prices).';

CREATE INDEX IF NOT EXISTS order_items_order_idx ON commerce.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON commerce.order_items (product_id);
