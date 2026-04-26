-- ============================================================
-- 0012_classification_ruleset_auditability.sql
-- F2A-03: adiciona ruleset_hash em conversation_classifications
-- e atualiza idempotencia para incluir ruleset_hash.
-- ============================================================

-- Adiciona coluna ruleset_hash com sentinela default para backfill
ALTER TABLE analytics.conversation_classifications
  ADD COLUMN IF NOT EXISTS ruleset_hash TEXT NOT NULL DEFAULT 'pre_audit_v1';

COMMENT ON COLUMN analytics.conversation_classifications.ruleset_hash IS
  'SHA-256 do ruleset usado para gerar a classificacao. pre_audit_v1 = linha antiga antes de existir auditoria por ruleset_hash.';

-- Remove constraint antiga (sem ruleset_hash) que impediria historico por ruleset.
-- A nova classifications_dedup_key assume o papel de dedup com ruleset_hash incluso.
ALTER TABLE analytics.conversation_classifications
  DROP CONSTRAINT IF EXISTS conversation_classifications_environment_conversation_id_di_key;

-- Remove duplicatas pre-existentes antes de criar a constraint UNIQUE,
-- mantendo a linha mais recente (maior created_at) de cada grupo.
DELETE FROM analytics.conversation_classifications a
USING analytics.conversation_classifications b
WHERE a.id < b.id
  AND a.environment = b.environment
  AND a.conversation_id = b.conversation_id
  AND a.dimension = b.dimension
  AND a.source = b.source
  AND a.extractor_version = b.extractor_version
  AND COALESCE(a.ruleset_hash, '') = COALESCE(b.ruleset_hash, '');

-- Constraint UNIQUE nova para idempotencia com ruleset_hash
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classifications_dedup_key'
      AND conrelid = 'analytics.conversation_classifications'::regclass
  ) THEN
    ALTER TABLE analytics.conversation_classifications
      ADD CONSTRAINT classifications_dedup_key
      UNIQUE (environment, conversation_id, dimension, source, extractor_version, ruleset_hash);
  END IF;
END $$;

COMMENT ON CONSTRAINT classifications_dedup_key ON analytics.conversation_classifications IS
  'Idempotencia: mesma classificacao com mesmo ruleset_hash aplicada duas vezes vira no-op via ON CONFLICT DO UPDATE.';
