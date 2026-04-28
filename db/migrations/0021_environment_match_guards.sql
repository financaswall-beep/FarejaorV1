-- ============================================================
-- 0021_environment_match_guards.sql
-- Triggers de validação cross-table para garantir que referências (FK)
-- nunca cruzem ambiente (prod ↔ test).
--
-- Padrão do projeto: toda tabela tem coluna `environment env_t`.
-- FKs cruzam apenas por UUID, mas o invariante "prod nunca mistura com
-- test" precisa ser enforçado no banco — não confiar só no ETL.
--
-- Implementação: função paramétrica única + 1 trigger por relação.
-- Cada trigger passa (target_schema, target_table, fk_column) via TG_ARGV.
-- A função pega o valor da coluna FK em NEW via JSONB e busca environment
-- na linha referenciada.
--
-- Idempotente: DROP TRIGGER IF EXISTS antes de CREATE.
-- ============================================================

-- ------------------------------------------------------------
-- Função paramétrica genérica
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops.validate_env_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_schema TEXT := TG_ARGV[0];
  v_target_table  TEXT := TG_ARGV[1];
  v_fk_column     TEXT := TG_ARGV[2];
  v_fk_value      UUID;
  v_target_env    TEXT;
  v_my_env        TEXT;
BEGIN
  -- Pega valor da FK em NEW via JSONB (genérico para qualquer tabela)
  v_fk_value := NULLIF(to_jsonb(NEW) ->> v_fk_column, '')::UUID;
  v_my_env   := to_jsonb(NEW) ->> 'environment';

  IF v_fk_value IS NULL THEN
    RETURN NEW;  -- FK nullable não setada, nada a validar
  END IF;

  IF v_my_env IS NULL THEN
    RAISE EXCEPTION 'env_match: tabela % sem coluna environment', TG_TABLE_NAME;
  END IF;

  EXECUTE format('SELECT environment::TEXT FROM %I.%I WHERE id = $1',
                 v_target_schema, v_target_table)
    USING v_fk_value
    INTO v_target_env;

  IF v_target_env IS NULL THEN
    RAISE EXCEPTION 'env_match: linha referenciada não encontrada %.%(id=%) ao inserir em %',
      v_target_schema, v_target_table, v_fk_value, TG_TABLE_NAME
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_target_env != v_my_env THEN
    RAISE EXCEPTION 'env_match violado: %.%(id=%) tem environment=%, mas insert/update em %.% com environment=%',
      v_target_schema, v_target_table, v_fk_value, v_target_env,
      TG_TABLE_SCHEMA, TG_TABLE_NAME, v_my_env
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION ops.validate_env_match IS
  'Trigger paramétrica: valida que NEW.<fk_column> referencia linha de <target_schema>.<target_table> com mesmo environment. Aplica em FKs cross-table. Argumentos via TG_ARGV: target_schema, target_table, fk_column.';

-- ------------------------------------------------------------
-- Macro de criação de trigger (apenas comentário-padrão; CREATE TRIGGER é literal)
-- ------------------------------------------------------------
-- Padrão: CREATE TRIGGER <nome> BEFORE INSERT OR UPDATE OF <col> ON <tabela>
--         FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match(
--           '<target_schema>', '<target_table>', '<col>');

-- ------------------------------------------------------------
-- agent.* → core.conversations / agent.* / commerce.*
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS env_match_session_current_conv ON agent.session_current;
CREATE TRIGGER env_match_session_current_conv
  BEFORE INSERT OR UPDATE OF conversation_id ON agent.session_current
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_session_events_conv ON agent.session_events;
CREATE TRIGGER env_match_session_events_conv
  BEFORE INSERT ON agent.session_events
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_turns_conv ON agent.turns;
CREATE TRIGGER env_match_turns_conv
  BEFORE INSERT OR UPDATE OF conversation_id ON agent.turns
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_pending_conf_conv ON agent.pending_confirmations;
CREATE TRIGGER env_match_pending_conf_conv
  BEFORE INSERT OR UPDATE OF conversation_id ON agent.pending_confirmations
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_cart_current_conv ON agent.cart_current;
CREATE TRIGGER env_match_cart_current_conv
  BEFORE INSERT OR UPDATE OF conversation_id ON agent.cart_current
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_cart_items_cart ON agent.cart_current_items;
CREATE TRIGGER env_match_cart_items_cart
  BEFORE INSERT OR UPDATE OF cart_id ON agent.cart_current_items
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('agent', 'cart_current', 'cart_id');

DROP TRIGGER IF EXISTS env_match_cart_items_product ON agent.cart_current_items;
CREATE TRIGGER env_match_cart_items_product
  BEFORE INSERT OR UPDATE OF product_id ON agent.cart_current_items
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'products', 'product_id');

DROP TRIGGER IF EXISTS env_match_cart_events_conv ON agent.cart_events;
CREATE TRIGGER env_match_cart_events_conv
  BEFORE INSERT ON agent.cart_events
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_drafts_conv ON agent.order_drafts;
CREATE TRIGGER env_match_drafts_conv
  BEFORE INSERT OR UPDATE OF conversation_id ON agent.order_drafts
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_drafts_geo ON agent.order_drafts;
CREATE TRIGGER env_match_drafts_geo
  BEFORE INSERT OR UPDATE OF geo_resolution_id ON agent.order_drafts
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'geo_resolutions', 'geo_resolution_id');

DROP TRIGGER IF EXISTS env_match_drafts_order ON agent.order_drafts;
CREATE TRIGGER env_match_drafts_order
  BEFORE INSERT OR UPDATE OF promoted_order_id ON agent.order_drafts
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'orders', 'promoted_order_id');

DROP TRIGGER IF EXISTS env_match_escal_conv ON agent.escalations;
CREATE TRIGGER env_match_escal_conv
  BEFORE INSERT OR UPDATE OF conversation_id ON agent.escalations
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

-- ------------------------------------------------------------
-- commerce.* → commerce.* / core.*
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS env_match_tire_specs_product ON commerce.tire_specs;
CREATE TRIGGER env_match_tire_specs_product
  BEFORE INSERT OR UPDATE OF product_id ON commerce.tire_specs
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'products', 'product_id');

DROP TRIGGER IF EXISTS env_match_media_product ON commerce.product_media;
CREATE TRIGGER env_match_media_product
  BEFORE INSERT OR UPDATE OF product_id ON commerce.product_media
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'products', 'product_id');

DROP TRIGGER IF EXISTS env_match_stock_product ON commerce.stock_levels;
CREATE TRIGGER env_match_stock_product
  BEFORE INSERT OR UPDATE OF product_id ON commerce.stock_levels
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'products', 'product_id');

DROP TRIGGER IF EXISTS env_match_prices_product ON commerce.product_prices;
CREATE TRIGGER env_match_prices_product
  BEFORE INSERT OR UPDATE OF product_id ON commerce.product_prices
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'products', 'product_id');

DROP TRIGGER IF EXISTS env_match_fitments_vehicle ON commerce.vehicle_fitments;
CREATE TRIGGER env_match_fitments_vehicle
  BEFORE INSERT OR UPDATE OF vehicle_model_id ON commerce.vehicle_fitments
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'vehicle_models', 'vehicle_model_id');

DROP TRIGGER IF EXISTS env_match_fitments_tire ON commerce.vehicle_fitments;
CREATE TRIGGER env_match_fitments_tire
  BEFORE INSERT OR UPDATE OF tire_spec_id ON commerce.vehicle_fitments
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'tire_specs', 'tire_spec_id');

DROP TRIGGER IF EXISTS env_match_delivery_geo ON commerce.delivery_zones;
CREATE TRIGGER env_match_delivery_geo
  BEFORE INSERT OR UPDATE OF geo_resolution_id ON commerce.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'geo_resolutions', 'geo_resolution_id');

DROP TRIGGER IF EXISTS env_match_disc_vehicle ON commerce.fitment_discoveries;
CREATE TRIGGER env_match_disc_vehicle
  BEFORE INSERT OR UPDATE OF vehicle_model_id ON commerce.fitment_discoveries
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'vehicle_models', 'vehicle_model_id');

DROP TRIGGER IF EXISTS env_match_disc_tire ON commerce.fitment_discoveries;
CREATE TRIGGER env_match_disc_tire
  BEFORE INSERT OR UPDATE OF tire_spec_id ON commerce.fitment_discoveries
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'tire_specs', 'tire_spec_id');

DROP TRIGGER IF EXISTS env_match_disc_conv ON commerce.fitment_discoveries;
CREATE TRIGGER env_match_disc_conv
  BEFORE INSERT OR UPDATE OF evidence_conversation_id ON commerce.fitment_discoveries
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'evidence_conversation_id');

DROP TRIGGER IF EXISTS env_match_disc_promoted ON commerce.fitment_discoveries;
CREATE TRIGGER env_match_disc_promoted
  BEFORE INSERT OR UPDATE OF promoted_to_fitment_id ON commerce.fitment_discoveries
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'vehicle_fitments', 'promoted_to_fitment_id');

DROP TRIGGER IF EXISTS env_match_import_errors_batch ON commerce.import_errors;
CREATE TRIGGER env_match_import_errors_batch
  BEFORE INSERT OR UPDATE OF import_batch_id ON commerce.import_errors
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'import_batches', 'import_batch_id');

DROP TRIGGER IF EXISTS env_match_orders_contact ON commerce.orders;
CREATE TRIGGER env_match_orders_contact
  BEFORE INSERT OR UPDATE OF contact_id ON commerce.orders
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'contacts', 'contact_id');

DROP TRIGGER IF EXISTS env_match_orders_conv ON commerce.orders;
CREATE TRIGGER env_match_orders_conv
  BEFORE INSERT OR UPDATE OF source_conversation_id ON commerce.orders
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'source_conversation_id');

DROP TRIGGER IF EXISTS env_match_orders_geo ON commerce.orders;
CREATE TRIGGER env_match_orders_geo
  BEFORE INSERT OR UPDATE OF geo_resolution_id ON commerce.orders
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'geo_resolutions', 'geo_resolution_id');

DROP TRIGGER IF EXISTS env_match_order_items_order ON commerce.order_items;
CREATE TRIGGER env_match_order_items_order
  BEFORE INSERT OR UPDATE OF order_id ON commerce.order_items
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'orders', 'order_id');

DROP TRIGGER IF EXISTS env_match_order_items_product ON commerce.order_items;
CREATE TRIGGER env_match_order_items_product
  BEFORE INSERT OR UPDATE OF product_id ON commerce.order_items
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('commerce', 'products', 'product_id');

-- ------------------------------------------------------------
-- analytics.fact_evidence → analytics.conversation_facts
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS env_match_fact_evidence_fact ON analytics.fact_evidence;
CREATE TRIGGER env_match_fact_evidence_fact
  BEFORE INSERT ON analytics.fact_evidence
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('analytics', 'conversation_facts', 'fact_id');

-- ------------------------------------------------------------
-- ops.* (Fase 3) → core.* / agent.*
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS env_match_atendente_jobs_conv ON ops.atendente_jobs;
CREATE TRIGGER env_match_atendente_jobs_conv
  BEFORE INSERT OR UPDATE OF conversation_id ON ops.atendente_jobs
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_enrichment_jobs_conv ON ops.enrichment_jobs;
CREATE TRIGGER env_match_enrichment_jobs_conv
  BEFORE INSERT OR UPDATE OF conversation_id ON ops.enrichment_jobs
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_unhandled_conv ON ops.unhandled_messages;
CREATE TRIGGER env_match_unhandled_conv
  BEFORE INSERT OR UPDATE OF conversation_id ON ops.unhandled_messages
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_incidents_conv ON ops.agent_incidents;
CREATE TRIGGER env_match_incidents_conv
  BEFORE INSERT OR UPDATE OF conversation_id ON ops.agent_incidents
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('core', 'conversations', 'conversation_id');

DROP TRIGGER IF EXISTS env_match_incidents_turn ON ops.agent_incidents;
CREATE TRIGGER env_match_incidents_turn
  BEFORE INSERT OR UPDATE OF agent_turn_id ON ops.agent_incidents
  FOR EACH ROW EXECUTE FUNCTION ops.validate_env_match('agent', 'turns', 'agent_turn_id');

-- ============================================================
-- Parte 2: environment imutável após INSERT
--
-- Sem isso, validate_env_match pode ser burlado:
--   UPDATE agent.turns SET environment = 'test' WHERE id = X
-- não muda nenhuma FK, mas inverte o ambiente da linha sem disparar guard.
--
-- Solução: trigger BEFORE UPDATE OF environment que rejeita qualquer mudança.
-- environment é imutável após criação. Isso é invariante do projeto.
-- ============================================================

CREATE OR REPLACE FUNCTION ops.enforce_environment_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.environment IS DISTINCT FROM NEW.environment THEN
    RAISE EXCEPTION 'environment é imutável após INSERT (table=%.%, id=%, old=%, new=%)',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id, OLD.environment, NEW.environment
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION ops.enforce_environment_immutable IS
  'Bloqueia UPDATE de coluna environment. Aplicar em todas as tabelas da Fase 3 com env_t. Sem isso, validate_env_match pode ser burlado mudando só environment.';

-- agent.*
DROP TRIGGER IF EXISTS env_immutable_session_current ON agent.session_current;
CREATE TRIGGER env_immutable_session_current
  BEFORE UPDATE OF environment ON agent.session_current
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_turns ON agent.turns;
CREATE TRIGGER env_immutable_turns
  BEFORE UPDATE OF environment ON agent.turns
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_pending_conf ON agent.pending_confirmations;
CREATE TRIGGER env_immutable_pending_conf
  BEFORE UPDATE OF environment ON agent.pending_confirmations
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_cart_current ON agent.cart_current;
CREATE TRIGGER env_immutable_cart_current
  BEFORE UPDATE OF environment ON agent.cart_current
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_cart_items ON agent.cart_current_items;
CREATE TRIGGER env_immutable_cart_items
  BEFORE UPDATE OF environment ON agent.cart_current_items
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_order_drafts ON agent.order_drafts;
CREATE TRIGGER env_immutable_order_drafts
  BEFORE UPDATE OF environment ON agent.order_drafts
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_escalations ON agent.escalations;
CREATE TRIGGER env_immutable_escalations
  BEFORE UPDATE OF environment ON agent.escalations
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

-- (session_events e cart_events já são append-only via 0017; UPDATE já bloqueado.)

-- commerce.*
DROP TRIGGER IF EXISTS env_immutable_products ON commerce.products;
CREATE TRIGGER env_immutable_products
  BEFORE UPDATE OF environment ON commerce.products
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_tire_specs ON commerce.tire_specs;
CREATE TRIGGER env_immutable_tire_specs
  BEFORE UPDATE OF environment ON commerce.tire_specs
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_vehicle_models ON commerce.vehicle_models;
CREATE TRIGGER env_immutable_vehicle_models
  BEFORE UPDATE OF environment ON commerce.vehicle_models
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_vehicle_fitments ON commerce.vehicle_fitments;
CREATE TRIGGER env_immutable_vehicle_fitments
  BEFORE UPDATE OF environment ON commerce.vehicle_fitments
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_product_media ON commerce.product_media;
CREATE TRIGGER env_immutable_product_media
  BEFORE UPDATE OF environment ON commerce.product_media
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_stock_levels ON commerce.stock_levels;
CREATE TRIGGER env_immutable_stock_levels
  BEFORE UPDATE OF environment ON commerce.stock_levels
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_product_prices ON commerce.product_prices;
CREATE TRIGGER env_immutable_product_prices
  BEFORE UPDATE OF environment ON commerce.product_prices
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_geo_resolutions ON commerce.geo_resolutions;
CREATE TRIGGER env_immutable_geo_resolutions
  BEFORE UPDATE OF environment ON commerce.geo_resolutions
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_delivery_zones ON commerce.delivery_zones;
CREATE TRIGGER env_immutable_delivery_zones
  BEFORE UPDATE OF environment ON commerce.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_store_policies ON commerce.store_policies;
CREATE TRIGGER env_immutable_store_policies
  BEFORE UPDATE OF environment ON commerce.store_policies
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_import_batches ON commerce.import_batches;
CREATE TRIGGER env_immutable_import_batches
  BEFORE UPDATE OF environment ON commerce.import_batches
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_import_errors ON commerce.import_errors;
CREATE TRIGGER env_immutable_import_errors
  BEFORE UPDATE OF environment ON commerce.import_errors
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_fitment_discoveries ON commerce.fitment_discoveries;
CREATE TRIGGER env_immutable_fitment_discoveries
  BEFORE UPDATE OF environment ON commerce.fitment_discoveries
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_orders ON commerce.orders;
CREATE TRIGGER env_immutable_orders
  BEFORE UPDATE OF environment ON commerce.orders
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_order_items ON commerce.order_items;
CREATE TRIGGER env_immutable_order_items
  BEFORE UPDATE OF environment ON commerce.order_items
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

-- analytics.fact_evidence (nova; conversation_facts legacy fica fora do escopo Fase 3)
DROP TRIGGER IF EXISTS env_immutable_fact_evidence ON analytics.fact_evidence;
CREATE TRIGGER env_immutable_fact_evidence
  BEFORE UPDATE OF environment ON analytics.fact_evidence
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

-- ops.* (apenas tabelas novas da Fase 3)
DROP TRIGGER IF EXISTS env_immutable_atendente_jobs ON ops.atendente_jobs;
CREATE TRIGGER env_immutable_atendente_jobs
  BEFORE UPDATE OF environment ON ops.atendente_jobs
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

-- ops.enrichment_jobs: tabela legada (0005), mas estendida em 0019 com conversation_id
-- e agora participa do fluxo da Organizadora. env_match já está aplicado nela;
-- adicionar imutabilidade fecha o mesmo buraco que existiria via UPDATE de environment.
DROP TRIGGER IF EXISTS env_immutable_enrichment_jobs ON ops.enrichment_jobs;
CREATE TRIGGER env_immutable_enrichment_jobs
  BEFORE UPDATE OF environment ON ops.enrichment_jobs
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_unhandled ON ops.unhandled_messages;
CREATE TRIGGER env_immutable_unhandled
  BEFORE UPDATE OF environment ON ops.unhandled_messages
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

DROP TRIGGER IF EXISTS env_immutable_incidents ON ops.agent_incidents;
CREATE TRIGGER env_immutable_incidents
  BEFORE UPDATE OF environment ON ops.agent_incidents
  FOR EACH ROW EXECUTE FUNCTION ops.enforce_environment_immutable();

-- ------------------------------------------------------------
-- Notas
-- ------------------------------------------------------------
-- 1. FKs lógicas para core.messages (particionada) NÃO recebem trigger de
--    env_match porque a validação de existência+environment fica no ETL.
--
-- 2. Triggers em tabelas append-only (session_events, cart_events,
--    fact_evidence) usam BEFORE INSERT — UPDATE já bloqueado em 0017/0018.
--
-- 3. Tabelas legadas (core.*, raw.*, analytics.* legado, ops.* legado) NÃO
--    estão cobertas. O mesmo buraco "UPDATE de environment" existe lá. Para
--    fechar 100%, ver issue/migration futura `0022_environment_immutable_legacy`.
--    Decisão de escopo: Fase 3 cobre apenas as tabelas novas e analytics.fact_evidence.
--
-- 4. Performance: cada trigger faz um SELECT extra na tabela referenciada.
--    PK lookup, hot cache, impacto mínimo. Se virar gargalo, substituir por
--    FK composta com UNIQUE (environment, id) — exige reescrever PKs das alvos.
