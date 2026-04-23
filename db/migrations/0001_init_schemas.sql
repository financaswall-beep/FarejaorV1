-- ============================================================
-- 0001_init_schemas.sql
-- Extensions, schemas e tipos comuns usados em todas as camadas.
-- Idempotente: roda várias vezes sem quebrar.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- busca fuzzy em content de messages
CREATE EXTENSION IF NOT EXISTS btree_gin;   -- índices combinados btree+jsonb

-- Schemas (separação física por camada — permite RLS/grants distintos depois)
CREATE SCHEMA IF NOT EXISTS raw;        -- payload bruto de webhook, imutável
CREATE SCHEMA IF NOT EXISTS core;       -- entidades normalizadas vindas do Chatwoot
CREATE SCHEMA IF NOT EXISTS analytics;  -- tabelas derivadas, com proveniência obrigatória
CREATE SCHEMA IF NOT EXISTS ops;        -- operacional: filas, snapshots, logs de apagamento

COMMENT ON SCHEMA raw       IS 'Payload bruto do webhook Chatwoot. Imutável. Fonte da verdade para replay.';
COMMENT ON SCHEMA core      IS 'Normalização 1:1 do que vem do Chatwoot. Sem interpretação.';
COMMENT ON SCHEMA analytics IS 'Tabelas derivadas. Toda linha carrega proveniência (truth_type/source/confidence).';
COMMENT ON SCHEMA ops       IS 'Operacional: filas de enrichment, snapshots imutáveis, logs de apagamento LGPD.';

-- Domínio: environment (prod/test). Aparece em TODA tabela.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'env_t') THEN
    CREATE DOMAIN env_t AS TEXT CHECK (VALUE IN ('prod', 'test'));
  END IF;
END$$;

COMMENT ON DOMAIN env_t IS 'Separação prod/test. Obrigatório em toda tabela. Produção nunca mistura com teste.';
