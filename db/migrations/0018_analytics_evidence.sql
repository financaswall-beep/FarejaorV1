-- ============================================================
-- 0018_analytics_evidence.sql
-- Tabela analytics.fact_evidence: texto literal que justifica cada fact extraído pela LLM.
-- Idempotente.
--
-- NOTA: analytics.conversation_facts.superseded_by JÁ EXISTE desde 0004.
-- Não recriamos. Esta migration adiciona apenas fact_evidence + view current_facts.
-- ============================================================

-- ------------------------------------------------------------
-- fact_evidence — proveniência textual literal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics.fact_evidence (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         env_t       NOT NULL,
  fact_id             UUID        NOT NULL REFERENCES analytics.conversation_facts(id) ON DELETE CASCADE,
  from_message_id     UUID        NOT NULL,  -- FK lógica para core.messages(id) (tabela particionada por sent_at, PK composta).
  evidence_text       TEXT        NOT NULL,
  evidence_type       TEXT        NOT NULL CHECK (evidence_type IN ('literal', 'inferred', 'confirmed_by_question')),
  extractor_version   TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fact_id, from_message_id, evidence_type),
  CHECK (evidence_type != 'literal' OR length(trim(evidence_text)) > 0)
);

COMMENT ON TABLE analytics.fact_evidence IS 'Texto literal da mensagem que justifica cada fact da Organizadora. Sem evidence, fact da LLM é rejeitado.';
COMMENT ON COLUMN analytics.fact_evidence.evidence_type IS
  'literal: trecho textual exato da mensagem; inferred: interpretação ainda derivada de mensagem do cliente; confirmed_by_question: cliente respondeu sim a pergunta direta do agente.';

CREATE INDEX IF NOT EXISTS fact_evidence_fact_idx ON analytics.fact_evidence (fact_id);
CREATE INDEX IF NOT EXISTS fact_evidence_message_idx ON analytics.fact_evidence (from_message_id);
CREATE INDEX IF NOT EXISTS fact_evidence_extractor_idx ON analytics.fact_evidence (extractor_version);

-- ------------------------------------------------------------
-- TRIGGER: bloquear UPDATE e DELETE direto em fact_evidence (append-only).
--
-- Importante: triggers BEFORE DELETE em PostgreSQL DISPARAM mesmo quando o
-- DELETE vem de CASCADE de FK. Para permitir o CASCADE da conversation_facts
-- (única forma legítima de remoção, ex: anonimização LGPD), usamos a flag de
-- sessão `analytics.allow_evidence_cascade`. Antes de DELETE em conversation_facts
-- com CASCADE esperado, a procedure dedicada deve fazer:
--
--   SET LOCAL analytics.allow_evidence_cascade = 'on';
--
-- Sem essa flag, DELETE direto em fact_evidence é bloqueado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics.enforce_fact_evidence_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_allow_cascade TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'analytics.fact_evidence is append-only: UPDATE blocked (id=%).', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    BEGIN
      v_allow_cascade := current_setting('analytics.allow_evidence_cascade', true);
    EXCEPTION WHEN OTHERS THEN
      v_allow_cascade := NULL;
    END;

    IF v_allow_cascade IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'analytics.fact_evidence is append-only: DELETE direto bloqueado (id=%). Use procedure dedicada (anonimização LGPD) que setar analytics.allow_evidence_cascade=on.', OLD.id
        USING ERRCODE = 'restrict_violation';
    END IF;

    -- DELETE permitido pela flag de cascade. Retorna OLD para deixar o DELETE seguir.
    -- (BEFORE DELETE: retornar NULL/NEW cancela; OLD permite.)
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fact_evidence_immutable_trg ON analytics.fact_evidence;
CREATE TRIGGER fact_evidence_immutable_trg
  BEFORE UPDATE OR DELETE ON analytics.fact_evidence
  FOR EACH ROW EXECUTE FUNCTION analytics.enforce_fact_evidence_immutability();

-- ------------------------------------------------------------
-- VIEW: current_facts — fato atual por conversa+chave (não superseded)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.current_facts AS
SELECT
  cf.id,
  cf.environment,
  cf.conversation_id,
  cf.fact_key,
  cf.fact_value,
  cf.observed_at,
  cf.message_id,
  cf.truth_type,
  cf.source,
  cf.confidence_level,
  cf.extractor_version,
  cf.created_at,
  fe.evidence_text  AS latest_evidence_text,
  fe.from_message_id AS latest_evidence_message_id,
  fe.evidence_type  AS latest_evidence_type
FROM analytics.conversation_facts cf
LEFT JOIN LATERAL (
  SELECT evidence_text, from_message_id, evidence_type
  FROM analytics.fact_evidence
  WHERE fact_id = cf.id
  ORDER BY created_at DESC
  LIMIT 1
) fe ON true
WHERE cf.superseded_by IS NULL;

COMMENT ON VIEW analytics.current_facts IS 'Fato atual por conversa+chave. Exclui registros já supersededed. Inclui evidence mais recente.';

-- ------------------------------------------------------------
-- VIEW: current_classifications — classificação atual por conversa+dimension
-- (conversation_classifications já existe em 0004; aqui só consolidamos a leitura)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.current_classifications AS
SELECT DISTINCT ON (environment, conversation_id, dimension)
  id,
  environment,
  conversation_id,
  dimension,
  value,
  truth_type,
  source,
  confidence_level,
  extractor_version,
  notes,
  created_at
FROM analytics.conversation_classifications
ORDER BY environment, conversation_id, dimension, created_at DESC;

COMMENT ON VIEW analytics.current_classifications IS 'Classificação mais recente por conversa+dimension. Usada pelo Context Builder do Atendente.';
