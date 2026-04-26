-- ============================================================
-- 0010_analytics_ruleset_auditability.sql
-- F2A-02: adiciona ruleset_hash em hints/facts e UNIQUE em hints.
-- ============================================================

-- ruleset_hash em linguistic_hints
ALTER TABLE analytics.linguistic_hints
  ADD COLUMN IF NOT EXISTS ruleset_hash TEXT NOT NULL DEFAULT 'pre_audit_v1';

COMMENT ON COLUMN analytics.linguistic_hints.ruleset_hash IS
  'SHA-256 dos bytes brutos de rules.json + newline + lexicon.json. pre_audit_v1 = linha antiga.';

-- ruleset_hash em conversation_facts
ALTER TABLE analytics.conversation_facts
  ADD COLUMN IF NOT EXISTS ruleset_hash TEXT NOT NULL DEFAULT 'pre_audit_v1';

COMMENT ON COLUMN analytics.conversation_facts.ruleset_hash IS
  'SHA-256 dos bytes brutos de rules.json + newline + lexicon.json. pre_audit_v1 = linha antiga.';

-- UNIQUE constraint para idempotencia de hints
-- pattern_id e obrigatorio para hints gerados por regras; linhas antigas sem
-- pattern_id recebem sentinela explicita antes da constraint.
ALTER TABLE analytics.linguistic_hints
  ALTER COLUMN pattern_id SET DEFAULT 'unknown_pattern';

UPDATE analytics.linguistic_hints
SET pattern_id = 'unknown_pattern'
WHERE pattern_id IS NULL;

ALTER TABLE analytics.linguistic_hints
  ALTER COLUMN pattern_id SET NOT NULL;

-- Remove duplicatas existentes antes de criar a constraint, mantendo a mais recente
DELETE FROM analytics.linguistic_hints a
USING analytics.linguistic_hints b
WHERE a.id < b.id
  AND a.environment = b.environment
  AND a.conversation_id = b.conversation_id
  AND a.message_id = b.message_id
  AND a.hint_type = b.hint_type
  AND COALESCE(a.pattern_id, '') = COALESCE(b.pattern_id, '')
  AND a.source = b.source
  AND a.extractor_version = b.extractor_version
  AND COALESCE(a.ruleset_hash, '') = COALESCE(b.ruleset_hash, '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hints_dedup_key'
      AND conrelid = 'analytics.linguistic_hints'::regclass
  ) THEN
    ALTER TABLE analytics.linguistic_hints
      ADD CONSTRAINT hints_dedup_key
      UNIQUE (environment, conversation_id, message_id, hint_type, pattern_id, source, extractor_version, ruleset_hash);
  END IF;
END $$;

COMMENT ON CONSTRAINT hints_dedup_key ON analytics.linguistic_hints IS
  'Idempotencia: mesma regra aplicada duas vezes vira no-op via ON CONFLICT DO NOTHING.';
