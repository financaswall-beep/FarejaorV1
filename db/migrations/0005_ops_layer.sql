-- ============================================================
-- 0005_ops_layer.sql
-- Camada OPS: operacional. Snapshots imutáveis, filas de enrichment,
-- logs de apagamento LGPD, eventos do bot.
-- Tabelas criadas no MVP — populadas ao longo das fases.
-- ============================================================

-- ------------------------------------------------------------
-- stock_snapshots — estoque/preço no momento exato da pergunta
-- Fase 3: populado quando ligar integração ERP. MVP: tabela vazia.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.stock_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment      env_t       NOT NULL,
  conversation_id  UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  message_id       UUID,                -- momento exato da pergunta
  sku              TEXT        NOT NULL,
  product_name     TEXT,
  tire_size        TEXT,
  brand            TEXT,
  stock_qty        INTEGER,
  price_brl        NUMERIC(10, 2),
  promo_price_brl  NUMERIC(10, 2),
  snapshot_at      TIMESTAMPTZ NOT NULL, -- quando consultamos o ERP
  erp_source       TEXT        NOT NULL, -- qual sistema de estoque
  raw_payload      JSONB
);

COMMENT ON TABLE ops.stock_snapshots IS 'Imutável. Responde "qual era o preço/estoque quando o cliente perguntou?" meses depois. Fase 3.';

CREATE INDEX IF NOT EXISTS stock_conv_idx
  ON ops.stock_snapshots (conversation_id);

CREATE INDEX IF NOT EXISTS stock_sku_time_idx
  ON ops.stock_snapshots (sku, snapshot_at DESC);

-- ------------------------------------------------------------
-- enrichment_jobs — fila de trabalhos async (transcrição, LLM, geocoding)
-- Fase 2: workers consomem.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.enrichment_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment   env_t       NOT NULL,
  job_type      TEXT        NOT NULL
                CHECK (job_type IN ('audio_transcription', 'image_ocr', 'llm_classification',
                                    'geocoding', 'erp_price_lookup', 'fact_extraction')),
  target_type   TEXT        NOT NULL,  -- message / conversation / attachment
  target_id     UUID        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'running', 'done', 'failed', 'skipped')),
  priority      SMALLINT    NOT NULL DEFAULT 5,
  attempts      SMALLINT    NOT NULL DEFAULT 0,
  last_error    TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  result_ref    JSONB,       -- ponteiro pra onde o resultado ficou (ex: {"table":"analytics.conversation_facts","id":"..."})
  worker_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ops.enrichment_jobs IS 'Fila de jobs async. Fase 2 introduz workers. MVP só tem a infra.';

CREATE INDEX IF NOT EXISTS jobs_pending_idx
  ON ops.enrichment_jobs (status, scheduled_at) WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS jobs_target_idx
  ON ops.enrichment_jobs (target_type, target_id);

-- ------------------------------------------------------------
-- bot_events — tool calls, fallbacks, erros do agente
-- Fase 3: quando plugar agente LLM ativo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.bot_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment      env_t       NOT NULL,
  conversation_id  UUID        NOT NULL,
  message_id       UUID,
  event_type       TEXT        NOT NULL
                   CHECK (event_type IN ('tool_call', 'tool_result', 'fallback', 'error', 'handoff_triggered')),
  tool_name        TEXT,
  tool_input       JSONB,
  tool_output      JSONB,
  latency_ms       INTEGER,
  error_message    TEXT,
  occurred_at      TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ops.bot_events IS 'Telemetria do agente. Fase 3 popula. MVP só cria tabela.';

CREATE INDEX IF NOT EXISTS bot_events_conv_time_idx
  ON ops.bot_events (conversation_id, occurred_at);

CREATE INDEX IF NOT EXISTS bot_events_type_idx
  ON ops.bot_events (event_type);

-- ------------------------------------------------------------
-- erasure_log — trilha de auditoria LGPD
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.erasure_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment          env_t       NOT NULL,
  contact_id           UUID,                  -- pode ser null se o contato foi removido
  chatwoot_contact_id  BIGINT,
  requested_by         TEXT        NOT NULL,  -- quem solicitou (cliente / operador / automação)
  reason               TEXT,
  fields_anonymized    TEXT[],                -- ex: {name, phone_e164, email}
  executed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_by          TEXT        NOT NULL,  -- operador / sistema
  notes                TEXT
);

COMMENT ON TABLE ops.erasure_log IS 'Trilha de auditoria LGPD (direito ao esquecimento). Registra toda anonimização/remoção.';

-- ------------------------------------------------------------
-- Procedure de anonimização LGPD
-- Executa soft-delete + zera PII + registra em erasure_log.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops.anonymize_contact(
  p_contact_id  UUID,
  p_requested_by TEXT,
  p_executed_by  TEXT,
  p_reason       TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_chatwoot_id BIGINT;
  v_env env_t;
BEGIN
  SELECT chatwoot_contact_id, environment
  INTO v_chatwoot_id, v_env
  FROM core.contacts
  WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact % não existe', p_contact_id;
  END IF;

  -- Zera PII, mantém estrutura para agregados
  UPDATE core.contacts
  SET name              = NULL,
      phone_e164        = NULL,
      email             = NULL,
      identifier        = NULL,
      custom_attributes = '{}'::jsonb,
      deleted_at        = now(),
      updated_at        = now()
  WHERE id = p_contact_id;

  -- Registra
  INSERT INTO ops.erasure_log (
    environment, contact_id, chatwoot_contact_id,
    requested_by, reason, fields_anonymized, executed_by
  ) VALUES (
    v_env, p_contact_id, v_chatwoot_id,
    p_requested_by, p_reason,
    ARRAY['name', 'phone_e164', 'email', 'identifier', 'custom_attributes'],
    p_executed_by
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ops.anonymize_contact IS 'LGPD direito ao esquecimento. Anonimiza PII, preserva agregados, registra em erasure_log.';
