-- ============================================================
-- 0004_analytics_layer.sql
-- Camada ANALYTICS: dados derivados, interpretados, classificados.
-- Proveniência obrigatória em TODA tabela (truth_type + source + confidence + extractor_version).
-- ============================================================

-- ------------------------------------------------------------
-- conversation_facts — EAV com proveniência
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics.conversation_facts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment        env_t       NOT NULL,
  conversation_id    UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  fact_key           TEXT        NOT NULL,  -- product_asked, price_quoted, shipping_quoted, payment_method, tire_size...
  fact_value         JSONB       NOT NULL,  -- ex: {"size":"100/80-18","brand":"Maggion"} ou {"amount":79.90,"currency":"BRL"}
  observed_at        TIMESTAMPTZ,            -- quando foi dito na conversa
  message_id         UUID,                   -- mensagem onde apareceu (lógica)
  truth_type         TEXT        NOT NULL CHECK (truth_type IN ('observed', 'inferred', 'predicted', 'corrected')),
  source             TEXT        NOT NULL,  -- regex_v1, llm_gpt4o_v3, human_review, chatwoot_custom_attr
  confidence_level   NUMERIC(3, 2) CHECK (confidence_level BETWEEN 0 AND 1),
  extractor_version  TEXT        NOT NULL,
  superseded_by      UUID REFERENCES analytics.conversation_facts(id), -- correções encadeadas
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, conversation_id, fact_key, source, extractor_version)
);

COMMENT ON TABLE  analytics.conversation_facts               IS 'Fatos extraídos (produto, preço, frete, motivo). EAV com proveniência.';
COMMENT ON COLUMN analytics.conversation_facts.superseded_by IS 'Correção: nova linha aponta pra anterior. Nunca UPDATE — preserva trail do erro do extrator.';
COMMENT ON COLUMN analytics.conversation_facts.fact_value    IS 'JSONB flexível. Ex: {"amount":450,"currency":"BRL"} pra preço, {"text":"Brás de Pina"} pra bairro.';

CREATE INDEX IF NOT EXISTS facts_conv_key_idx
  ON analytics.conversation_facts (conversation_id, fact_key);

CREATE INDEX IF NOT EXISTS facts_value_gin
  ON analytics.conversation_facts USING GIN (fact_value jsonb_path_ops);

CREATE INDEX IF NOT EXISTS facts_current_idx
  ON analytics.conversation_facts (fact_key) WHERE superseded_by IS NULL;

-- ------------------------------------------------------------
-- conversation_signals — métricas SQL agregadas (sem LLM)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics.conversation_signals (
  conversation_id         UUID PRIMARY KEY REFERENCES core.conversations(id) ON DELETE CASCADE,
  environment             env_t       NOT NULL,
  total_messages          INTEGER,
  contact_messages        INTEGER,
  agent_messages          INTEGER,
  bot_messages            INTEGER,
  media_message_count     INTEGER,
  media_text_ratio        NUMERIC(5, 4),
  first_response_seconds  INTEGER,    -- tempo até 1º reply do agente
  avg_agent_response_sec  INTEGER,
  max_gap_seconds         INTEGER,    -- maior gap = sinal de abandono
  total_duration_seconds  INTEGER,
  handoff_count           SMALLINT,
  started_hour_local      SMALLINT,   -- 0-23 fuso America/Sao_Paulo
  started_dow_local       SMALLINT,   -- 0=domingo .. 6=sábado
  computed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  extractor_version       TEXT        NOT NULL,
  source                  TEXT        NOT NULL DEFAULT 'sql_aggregation_v1',
  truth_type              TEXT        NOT NULL DEFAULT 'observed',
  confidence_level        NUMERIC(3, 2) DEFAULT 1.00
);

COMMENT ON TABLE analytics.conversation_signals IS 'Métricas derivadas via SQL puro. Recomputável a qualquer momento.';

-- ------------------------------------------------------------
-- conversation_classifications — stage/outcome/reason
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics.conversation_classifications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment        env_t       NOT NULL,
  conversation_id    UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  dimension          TEXT        NOT NULL
                     CHECK (dimension IN ('stage_reached', 'final_outcome', 'loss_reason',
                                          'buyer_intent', 'customer_type', 'urgency')),
  value              TEXT        NOT NULL,  -- TEXT livre por 4-8 semanas, promove a ENUM depois
  truth_type         TEXT        NOT NULL CHECK (truth_type IN ('observed', 'inferred', 'predicted', 'corrected')),
  source             TEXT        NOT NULL,
  confidence_level   NUMERIC(3, 2) CHECK (confidence_level BETWEEN 0 AND 1),
  extractor_version  TEXT        NOT NULL,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, conversation_id, dimension, source, extractor_version)
);

COMMENT ON COLUMN analytics.conversation_classifications.value IS 'TEXT + CHECK sob demanda. Promover a ENUM só após 4-8 semanas de taxonomia estável.';

CREATE INDEX IF NOT EXISTS classif_conv_dim_idx
  ON analytics.conversation_classifications (conversation_id, dimension);

-- ------------------------------------------------------------
-- customer_journey — perfil agregado por contato
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics.customer_journey (
  contact_id               UUID PRIMARY KEY REFERENCES core.contacts(id) ON DELETE CASCADE,
  environment              env_t       NOT NULL,
  total_conversations      INTEGER     NOT NULL DEFAULT 0,
  first_conversation_at    TIMESTAMPTZ,
  last_conversation_at     TIMESTAMPTZ,
  is_returning             BOOLEAN     NOT NULL DEFAULT false,
  days_since_first         INTEGER,
  purchase_count           INTEGER     DEFAULT 0,    -- populado via integração ERP (fase 3)
  partial_ltv_brl          NUMERIC(12, 2),           -- idem
  last_channel             TEXT,
  channel_migration_count  SMALLINT    NOT NULL DEFAULT 0,  -- cliente migrou entre IG/WA/FB
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  extractor_version        TEXT        NOT NULL,
  source                   TEXT        NOT NULL,
  truth_type               TEXT        NOT NULL DEFAULT 'inferred',
  confidence_level         NUMERIC(3, 2)
);

COMMENT ON COLUMN analytics.customer_journey.channel_migration_count IS 'Quantas vezes o contato trocou de canal (ex: IG → WA). Sinal de engajamento.';
COMMENT ON COLUMN analytics.customer_journey.purchase_count           IS 'Fase 3: populado via integração ERP. NULL/0 no MVP.';

-- ------------------------------------------------------------
-- linguistic_hints — heurísticas sem LLM
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics.linguistic_hints (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment        env_t       NOT NULL,
  conversation_id    UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  message_id         UUID        NOT NULL,  -- hint é sempre sobre mensagem específica
  hint_type          TEXT        NOT NULL
                     CHECK (hint_type IN ('negative_keyword', 'repetition', 'price_complaint',
                                          'urgency_marker', 'abandonment_marker', 'positive_marker',
                                          'competitor_mention')),
  matched_text       TEXT,
  pattern_id         TEXT,        -- id da regra que bateu (ex: "regex_price_complaint_v1_pattern3")
  truth_type         TEXT        NOT NULL DEFAULT 'observed',
  source             TEXT        NOT NULL,   -- regex_v1, heuristic_v2
  confidence_level   NUMERIC(3, 2),
  extractor_version  TEXT        NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE analytics.linguistic_hints IS 'Sinais textuais via regex/heurística. Sem LLM. Ex: "tá caro", "outro lugar", repetições.';

CREATE INDEX IF NOT EXISTS hints_conv_type_idx
  ON analytics.linguistic_hints (conversation_id, hint_type);
