-- ============================================================
-- 0002_raw_layer.sql
-- Camada RAW: payload cru de cada webhook do Chatwoot.
-- Imutável. Particionada por mês. Source of truth para replay.
-- ============================================================

CREATE TABLE IF NOT EXISTS raw.raw_events (
  id                    BIGSERIAL,
  environment           env_t        NOT NULL,
  chatwoot_delivery_id  TEXT         NOT NULL,  -- header X-Chatwoot-Delivery (UUID único por tentativa)
  chatwoot_signature    TEXT         NOT NULL,  -- header X-Chatwoot-Signature (HMAC — guardado p/ auditoria, não revalidado)
  chatwoot_timestamp    TIMESTAMPTZ,            -- header X-Chatwoot-Timestamp (quando Chatwoot emitiu)
  received_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),  -- quando nosso webhook recebeu
  event_type            TEXT         NOT NULL,  -- message_created, conversation_updated, etc.
  account_id            INTEGER,                -- desnormalizado do payload p/ filtro sem parsear JSONB
  payload               JSONB        NOT NULL,
  processing_status     TEXT         NOT NULL DEFAULT 'pending'
                        CHECK (processing_status IN ('pending', 'processed', 'failed', 'skipped')),
  processed_at          TIMESTAMPTZ,
  processing_error      TEXT,
  PRIMARY KEY (id, received_at),
  UNIQUE (environment, chatwoot_delivery_id, received_at)
) PARTITION BY RANGE (received_at);

COMMENT ON TABLE  raw.raw_events                    IS 'Payload bruto de cada webhook. Imutável após INSERT. Loop ETL atualiza só processing_status.';
COMMENT ON COLUMN raw.raw_events.chatwoot_delivery_id IS 'Chave de deduplicação natural. Replay do Chatwoot não gera linha nova.';
COMMENT ON COLUMN raw.raw_events.chatwoot_signature IS 'Guardamos mas não revalidamos depois. Serve p/ disputa forense sobre evento forjado.';
COMMENT ON COLUMN raw.raw_events.account_id         IS 'Desnormalizado p/ evitar GIN scan em filtros comuns.';
COMMENT ON COLUMN raw.raw_events.processing_status  IS 'Loop raw→core: pending → processed | failed (retry) | skipped (evento ignorado por regra).';

-- Partições mensais iniciais. Em produção use pg_partman p/ criar automaticamente.
CREATE TABLE IF NOT EXISTS raw.raw_events_2026_04 PARTITION OF raw.raw_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS raw.raw_events_2026_05 PARTITION OF raw.raw_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS raw.raw_events_2026_06 PARTITION OF raw.raw_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Índices
CREATE INDEX IF NOT EXISTS raw_events_received_at_brin
  ON raw.raw_events USING BRIN (received_at);

CREATE INDEX IF NOT EXISTS raw_events_pending_idx
  ON raw.raw_events (environment, processing_status)
  WHERE processing_status = 'pending';

CREATE INDEX IF NOT EXISTS raw_events_event_type_idx
  ON raw.raw_events (event_type);

CREATE INDEX IF NOT EXISTS raw_events_payload_gin
  ON raw.raw_events USING GIN (payload jsonb_path_ops);

CREATE INDEX IF NOT EXISTS raw_events_account_id_idx
  ON raw.raw_events (environment, account_id) WHERE account_id IS NOT NULL;
