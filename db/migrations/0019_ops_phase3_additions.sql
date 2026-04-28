-- ============================================================
-- 0019_ops_phase3_additions.sql
-- Adições da Fase 3 ao schema ops:
--   - ops.atendente_jobs (NOVA: fila do worker da Atendente)
--   - ops.enrichment_jobs (ALTER: ganha campos para o desenho final da Organizadora)
--   - ops.unhandled_messages (NOVA: mensagens que caíram em responder_geral)
--   - ops.agent_incidents (NOVA: bloqueios e falhas)
--
-- ATENÇÃO: ops.enrichment_jobs já existe desde 0005 com schema antigo.
-- Esta migration ESTENDE sem quebrar o que já está populado.
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- ops.enrichment_jobs — extensões para Fase 3
-- ------------------------------------------------------------

-- Adicionar conversation_id direto (já existe target_id, mas como UUID genérico)
ALTER TABLE ops.enrichment_jobs
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES core.conversations(id) ON DELETE CASCADE;

-- FKs lógicas para core.messages: tabela é particionada por sent_at (PK composta),
-- então REFERENCES diretas falham. Validação fica no ETL/repositório.
ALTER TABLE ops.enrichment_jobs
  ADD COLUMN IF NOT EXISTS last_message_id UUID;

ALTER TABLE ops.enrichment_jobs
  ADD COLUMN IF NOT EXISTS last_processed_message_id UUID;

ALTER TABLE ops.enrichment_jobs
  ADD COLUMN IF NOT EXISTS not_before TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE ops.enrichment_jobs
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

ALTER TABLE ops.enrichment_jobs
  ADD COLUMN IF NOT EXISTS locked_by TEXT;

-- Estender CHECK de job_type para aceitar os novos tipos da Fase 3
ALTER TABLE ops.enrichment_jobs
  DROP CONSTRAINT IF EXISTS enrichment_jobs_job_type_check;

ALTER TABLE ops.enrichment_jobs
  ADD CONSTRAINT enrichment_jobs_job_type_check
  CHECK (job_type IN (
    'audio_transcription', 'image_ocr', 'llm_classification',
    'geocoding', 'erp_price_lookup', 'fact_extraction',
    'organize_conversation', 'reenrich_conversation', 'backfill'
  ));

-- Estender CHECK de status para aceitar os novos status (mantendo compatibilidade)
ALTER TABLE ops.enrichment_jobs
  DROP CONSTRAINT IF EXISTS enrichment_jobs_status_check;

ALTER TABLE ops.enrichment_jobs
  ADD CONSTRAINT enrichment_jobs_status_check
  CHECK (status IN (
    'queued', 'running', 'done', 'failed', 'skipped',
    'pending', 'processing', 'processed'
  ));

COMMENT ON COLUMN ops.enrichment_jobs.conversation_id IS 'FK direta (Fase 3). Anteriormente usava-se target_id genérico.';
COMMENT ON COLUMN ops.enrichment_jobs.not_before IS 'Debounce de 60-120s (Fase 3). Worker só pega quando not_before <= now().';
COMMENT ON COLUMN ops.enrichment_jobs.last_message_id IS 'Última mensagem da conversa quando o job foi enfileirado.';
COMMENT ON COLUMN ops.enrichment_jobs.last_processed_message_id IS 'Até qual mensagem o worker processou. Permite retomar.';

-- Índice para o padrão da Organizadora: pegar jobs prontos
CREATE INDEX IF NOT EXISTS enrichment_jobs_pickup_idx
  ON ops.enrichment_jobs (not_before, status)
  WHERE status IN ('pending', 'processing');

-- UNIQUE parcial para upsert por conversa (Fase 3 pattern)
CREATE UNIQUE INDEX IF NOT EXISTS enrichment_jobs_conv_unique_pending
  ON ops.enrichment_jobs (environment, conversation_id, job_type)
  WHERE status IN ('pending', 'processing') AND conversation_id IS NOT NULL;

-- ------------------------------------------------------------
-- ops.atendente_jobs — fila do worker da Atendente (NOVA)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.atendente_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         env_t       NOT NULL,
  conversation_id     UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  trigger_message_id  UUID        NOT NULL,  -- FK lógica para core.messages(id) (tabela particionada).
  status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  not_before          TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts            SMALLINT    NOT NULL DEFAULT 0,
  locked_at           TIMESTAMPTZ,
  locked_by           TEXT,
  error_message       TEXT,
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, trigger_message_id)
);

COMMENT ON TABLE ops.atendente_jobs IS 'Fila do worker da Atendente. 1 job por mensagem do cliente. Worker pega em milissegundos.';
COMMENT ON COLUMN ops.atendente_jobs.trigger_message_id IS 'Mensagem do cliente que disparou. UNIQUE garante idempotência se webhook for reentregue.';

CREATE INDEX IF NOT EXISTS atendente_jobs_pickup_idx
  ON ops.atendente_jobs (not_before, status)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS atendente_jobs_conv_idx
  ON ops.atendente_jobs (conversation_id, created_at DESC);

-- ------------------------------------------------------------
-- ops.unhandled_messages — mensagens que caíram em responder_geral (NOVA)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.unhandled_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment          env_t       NOT NULL,
  conversation_id      UUID        NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
  message_id           UUID        NOT NULL,  -- FK lógica para core.messages(id) (tabela particionada).
  message_text         TEXT,
  fallback_reason      TEXT        NOT NULL CHECK (fallback_reason IN ('router_no_skill', 'policy_missing', 'data_missing', 'evidence_low', 'other')),
  skill_used           TEXT        NOT NULL DEFAULT 'responder_geral',
  reviewed_at          TIMESTAMPTZ,
  reviewed_by          TEXT,
  promoted_to_skill    TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, message_id)
);

COMMENT ON TABLE ops.unhandled_messages IS 'Mensagens que ativaram responder_geral. Insumo para criar skill nova.';

CREATE INDEX IF NOT EXISTS unhandled_pending_review_idx
  ON ops.unhandled_messages (created_at DESC)
  WHERE reviewed_at IS NULL;

CREATE INDEX IF NOT EXISTS unhandled_reason_idx
  ON ops.unhandled_messages (fallback_reason);

-- ------------------------------------------------------------
-- ops.agent_incidents — bloqueios e falhas (NOVA)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.agent_incidents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         env_t       NOT NULL,
  conversation_id     UUID        REFERENCES core.conversations(id) ON DELETE SET NULL,
  agent_turn_id       UUID        REFERENCES agent.turns(id) ON DELETE SET NULL,
  incident_type       TEXT        NOT NULL CHECK (incident_type IN (
                        'validator_blocked',
                        'llm_timeout',
                        'llm_api_error',
                        'pending_confirmation_expired',
                        'transaction_rollback',
                        'router_no_skill_matched',
                        'evidence_not_literal',
                        'schema_violation',
                        'context_build_failed',
                        'action_handler_failed'
                      )),
  severity            TEXT        NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  resolved_at         TIMESTAMPTZ,
  resolved_by         TEXT,
  resolution_notes    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ops.agent_incidents IS 'Bloqueios e falhas do agente. Validators, timeouts, schema violations, etc. Não escondidos em log solto.';

CREATE INDEX IF NOT EXISTS incidents_unresolved_idx
  ON ops.agent_incidents (severity, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS incidents_type_idx
  ON ops.agent_incidents (incident_type, created_at DESC);

CREATE INDEX IF NOT EXISTS incidents_conv_idx
  ON ops.agent_incidents (conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

-- ------------------------------------------------------------
-- Função utilitária: enfileirar enrichment_job com upsert (debounce)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops.enqueue_enrichment_job(
  p_environment       env_t,
  p_conversation_id   UUID,
  p_job_type          TEXT,
  p_last_message_id   UUID,
  p_debounce_seconds  INTEGER DEFAULT 90
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Tenta atualizar job pending/processing existente para a mesma conversa+tipo
  UPDATE ops.enrichment_jobs
  SET last_message_id = p_last_message_id,
      not_before      = now() + make_interval(secs => p_debounce_seconds)
  WHERE environment = p_environment
    AND conversation_id = p_conversation_id
    AND job_type = p_job_type
    AND status IN ('pending', 'processing')
  RETURNING id INTO v_job_id;

  IF v_job_id IS NOT NULL THEN
    RETURN v_job_id;
  END IF;

  -- Cria novo job
  INSERT INTO ops.enrichment_jobs (
    environment, conversation_id, job_type, status,
    target_type, target_id,
    last_message_id, not_before, scheduled_at
  ) VALUES (
    p_environment, p_conversation_id, p_job_type, 'pending',
    'conversation', p_conversation_id,
    p_last_message_id,
    now() + make_interval(secs => p_debounce_seconds),
    now() + make_interval(secs => p_debounce_seconds)
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

COMMENT ON FUNCTION ops.enqueue_enrichment_job IS 'Enfileira/atualiza job da Organizadora com debounce. Upsert por conversation_id+job_type.';

-- ------------------------------------------------------------
-- Função utilitária: enfileirar atendente_job
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops.enqueue_atendente_job(
  p_environment         env_t,
  p_conversation_id     UUID,
  p_trigger_message_id  UUID
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Tenta inserir. Se já existe (mesma trigger_message_id), DO NOTHING e v_job_id fica NULL.
  INSERT INTO ops.atendente_jobs (
    environment, conversation_id, trigger_message_id, status, not_before
  ) VALUES (
    p_environment, p_conversation_id, p_trigger_message_id, 'pending', now()
  )
  ON CONFLICT (environment, trigger_message_id) DO NOTHING
  RETURNING id INTO v_job_id;

  -- Idempotência: se houve conflito, busca o id do job existente para retornar.
  -- Webhook reentregue não deve aparecer como "falha de enfileiramento" para o caller.
  IF v_job_id IS NULL THEN
    SELECT id INTO v_job_id
    FROM ops.atendente_jobs
    WHERE environment = p_environment
      AND trigger_message_id = p_trigger_message_id;
  END IF;

  RETURN v_job_id;
END;
$$;

COMMENT ON FUNCTION ops.enqueue_atendente_job IS 'Enfileira job da Atendente com idempotência por trigger_message_id. Em conflito (webhook reentregue), retorna o id do job já existente.';
