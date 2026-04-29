-- ============================================================
-- 0022_conversation_facts_append_ledger.sql
-- Fase 3: libera analytics.conversation_facts para ledger append-only real.
--
-- A constraint UNIQUE original de 0004 impedia inserir dois fatos com a
-- mesma conversation_id + fact_key + source + extractor_version, o que quebrava
-- supersedencia por nova linha. Esta migration remove essa constraint legada e
-- cria uma deduplicacao mais estreita para evitar repeticao exata do mesmo fato
-- da Organizadora sem bloquear revisoes futuras.
-- ============================================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT c.conname
    INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'analytics'
    AND t.relname = 'conversation_facts'
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) LIKE '%UNIQUE (environment, conversation_id, fact_key, source, extractor_version)%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE analytics.conversation_facts DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS conversation_facts_llm_exact_dedup_idx
  ON analytics.conversation_facts (
    environment,
    conversation_id,
    fact_key,
    message_id,
    source,
    extractor_version,
    (md5(fact_value::text))
  )
  WHERE source = 'llm_openai_organizadora_v1'
    AND message_id IS NOT NULL;

COMMENT ON INDEX analytics.conversation_facts_llm_exact_dedup_idx IS
  'Deduplica repeticao exata da Organizadora sem bloquear ledger append-only e supersedencia por nova linha.';
