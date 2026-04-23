-- ============================================================
-- 0006_concurrency_guards.sql
-- Guards mínimos de concorrência antes do ETL.
-- Fecha dois furos estruturais:
--   (1) retry do Chatwoot duplicando linhas em raw.raw_events
--   (2) evento fora de ordem sobrescrevendo dados mais novos em core.*
-- Adiciona helper para criação automática de partições futuras.
-- ============================================================

-- ------------------------------------------------------------
-- (1) raw.delivery_seen — bouncer de deduplicação
-- ------------------------------------------------------------
-- Chatwoot pode re-entregar o mesmo webhook (X-Chatwoot-Delivery idêntico)
-- após timeout, retry automático ou replay manual. Como raw.raw_events é
-- particionada por received_at, UNIQUE(environment, delivery_id) precisa
-- incluir received_at → constraint NÃO protege contra retry.
--
-- Solução: tabela pequena, não-particionada, com PK em (environment, delivery_id).
-- ETL faz INSERT ... ON CONFLICT DO NOTHING nela ANTES de inserir em raw_events.
-- Se o INSERT retornar 0 linhas, é duplicata → descarta silenciosamente.
--
-- Volume esperado: ~1 linha por webhook único. Tabela cresce linearmente.
-- ~500k-2M linhas/ano na operação atual. Trivial pro Postgres.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw.delivery_seen (
  environment           env_t       NOT NULL,
  chatwoot_delivery_id  TEXT        NOT NULL,
  first_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_event_id          BIGINT,                  -- FK lógica p/ raw.raw_events.id (referência informativa)
  PRIMARY KEY (environment, chatwoot_delivery_id)
);

COMMENT ON TABLE raw.delivery_seen IS
  'Bouncer de dedup para webhooks. ETL insere AQUI primeiro; se conflitar, descarta o webhook e NÃO toca em raw.raw_events. Fecha o buraco de retry que UNIQUE(...,received_at) deixa.';

COMMENT ON COLUMN raw.delivery_seen.raw_event_id IS
  'Ponteiro pro id da linha original em raw.raw_events. Permite rastrear "esse delivery_id já foi processado como evento X".';

-- Padrão de uso no ETL (exemplo em pseudo-SQL):
--   WITH claim AS (
--     INSERT INTO raw.delivery_seen (environment, chatwoot_delivery_id)
--     VALUES ($1, $2)
--     ON CONFLICT DO NOTHING
--     RETURNING 1
--   )
--   INSERT INTO raw.raw_events (...)
--   SELECT ... WHERE EXISTS (SELECT 1 FROM claim);
--
-- Dentro de UMA transação. Se claim vazio, raw_events não recebe linha.

-- ------------------------------------------------------------
-- (2) Watermark last_event_at — ordem garantida em core.*
-- ------------------------------------------------------------
-- Rede não preserva ordem. message_updated pode chegar antes de
-- message_created. Sem watermark, upsert cego pode sobrescrever
-- estado mais novo com dados mais antigos.
--
-- Regra: toda linha em core.{contacts, conversations, messages}
-- carrega last_event_at = timestamp do evento do Chatwoot que a
-- tocou pela última vez. Trigger BEFORE UPDATE barra regressão.
-- ------------------------------------------------------------

ALTER TABLE core.contacts
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

COMMENT ON COLUMN core.contacts.last_event_at IS
  'Timestamp do evento Chatwoot que atualizou esta linha pela última vez (X-Chatwoot-Timestamp ou payload.updated_at). UPDATE com valor menor é bloqueado pelo trigger core.skip_stale_update.';

ALTER TABLE core.conversations
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

COMMENT ON COLUMN core.conversations.last_event_at IS
  'Watermark de ordem. Ver COMMENT em core.contacts.last_event_at.';

ALTER TABLE core.messages
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

COMMENT ON COLUMN core.messages.last_event_at IS
  'Watermark de ordem. Ver COMMENT em core.contacts.last_event_at.';

-- ------------------------------------------------------------
-- Trigger: bloqueia UPDATE quando incoming.last_event_at < current.last_event_at
-- Comportamento: RETURN OLD → UPDATE vira no-op, RAISE NOTICE loga o evento.
-- Não usamos RAISE EXCEPTION: não queremos matar a transação inteira do ETL
-- por um evento fora de ordem — é cenário esperado, não erro.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.skip_stale_update() RETURNS TRIGGER AS $$
BEGIN
  -- Se a linha não tinha watermark ainda, aceita a escrita
  IF OLD.last_event_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se o novo evento não traz watermark, trata como atualização legítima
  -- (escrita administrativa, backfill manual, etc.)
  IF NEW.last_event_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Regressão: descarta o UPDATE
  IF NEW.last_event_at < OLD.last_event_at THEN
    RAISE NOTICE 'Stale update ignored on %.% id=% incoming=% current=%',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id,
      NEW.last_event_at, OLD.last_event_at;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION core.skip_stale_update IS
  'Trigger BEFORE UPDATE. Se NEW.last_event_at < OLD.last_event_at, converte UPDATE em no-op e emite NOTICE. Aceita NULL em qualquer lado (primeira escrita ou atualização manual).';

DROP TRIGGER IF EXISTS contacts_watermark_guard ON core.contacts;
CREATE TRIGGER contacts_watermark_guard
  BEFORE UPDATE ON core.contacts
  FOR EACH ROW EXECUTE FUNCTION core.skip_stale_update();

DROP TRIGGER IF EXISTS conversations_watermark_guard ON core.conversations;
CREATE TRIGGER conversations_watermark_guard
  BEFORE UPDATE ON core.conversations
  FOR EACH ROW EXECUTE FUNCTION core.skip_stale_update();

DROP TRIGGER IF EXISTS messages_watermark_guard ON core.messages;
CREATE TRIGGER messages_watermark_guard
  BEFORE UPDATE ON core.messages
  FOR EACH ROW EXECUTE FUNCTION core.skip_stale_update();

-- Triggers em tabela particionada (core.messages) propagam automaticamente
-- para todas as partições existentes e futuras desde Postgres 11.

-- Padrão de upsert com watermark (redundância defensiva — trigger + WHERE):
--   INSERT INTO core.conversations (..., last_event_at) VALUES (..., $N)
--   ON CONFLICT (environment, chatwoot_conversation_id) DO UPDATE
--   SET ..., last_event_at = EXCLUDED.last_event_at
--   WHERE EXCLUDED.last_event_at >= core.conversations.last_event_at;

-- ------------------------------------------------------------
-- (3) Invariante documentada: ops.enrichment_jobs usa SKIP LOCKED
-- ------------------------------------------------------------
-- Sem enforcement no schema (Postgres não tem). Workers DEVEM puxar jobs com:
--   SELECT id, target_type, target_id, job_type
--   FROM ops.enrichment_jobs
--   WHERE status = 'queued' AND scheduled_at <= now()
--   ORDER BY priority, scheduled_at
--   LIMIT 10
--   FOR UPDATE SKIP LOCKED;
--
-- Dois workers rodando a mesma query nunca pegam o mesmo job.
-- Violação dessa regra = dupla execução de transcrição/LLM = custo real.
-- ------------------------------------------------------------
COMMENT ON TABLE ops.enrichment_jobs IS
  'Fila de jobs async. Fase 2 introduz workers. INVARIANTE DE LEITURA: workers DEVEM usar SELECT ... FOR UPDATE SKIP LOCKED ao puxar jobs. Caso contrário, múltiplos workers executam o mesmo job (custo $$ em chamadas LLM). Ver README.md seção "Concorrência".';

-- ------------------------------------------------------------
-- (4) Helper de partições futuras
-- ------------------------------------------------------------
-- Cria partições mensais para raw.raw_events e core.messages.
-- Idempotente: CREATE IF NOT EXISTS + captura duplicate_table.
-- Rode manualmente em dev; agende via pg_cron em prod.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops.ensure_monthly_partitions(p_months_ahead INTEGER DEFAULT 3)
RETURNS TABLE (partition_name TEXT, was_created BOOLEAN) AS $$
DECLARE
  v_month  DATE;
  v_next   DATE;
  v_suffix TEXT;
  v_name   TEXT;
  i        INTEGER;
BEGIN
  IF p_months_ahead < 0 OR p_months_ahead > 24 THEN
    RAISE EXCEPTION 'p_months_ahead deve estar entre 0 e 24, recebido %', p_months_ahead;
  END IF;

  FOR i IN 0..p_months_ahead LOOP
    v_month  := date_trunc('month', now())::date + (i || ' months')::interval;
    v_next   := v_month + INTERVAL '1 month';
    v_suffix := to_char(v_month, 'YYYY_MM');

    -- raw.raw_events
    v_name := 'raw_events_' || v_suffix;
    BEGIN
      EXECUTE format(
        'CREATE TABLE raw.%I PARTITION OF raw.raw_events FOR VALUES FROM (%L) TO (%L)',
        v_name, v_month, v_next
      );
      partition_name := 'raw.' || v_name;
      was_created := true;
      RETURN NEXT;
    EXCEPTION WHEN duplicate_table THEN
      partition_name := 'raw.' || v_name;
      was_created := false;
      RETURN NEXT;
    END;

    -- core.messages
    v_name := 'messages_' || v_suffix;
    BEGIN
      EXECUTE format(
        'CREATE TABLE core.%I PARTITION OF core.messages FOR VALUES FROM (%L) TO (%L)',
        v_name, v_month, v_next
      );
      partition_name := 'core.' || v_name;
      was_created := true;
      RETURN NEXT;
    EXCEPTION WHEN duplicate_table THEN
      partition_name := 'core.' || v_name;
      was_created := false;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ops.ensure_monthly_partitions IS
  'Cria partições mensais para raw.raw_events e core.messages a partir do mês atual. Idempotente. Rodar mensalmente (cron externo ou pg_cron) ou manualmente antes de deploy.';

-- Agendamento recomendado em Supabase (pg_cron disponível):
--   SELECT cron.schedule(
--     'farejador-ensure-partitions',
--     '0 3 20 * *',  -- dia 20 de cada mês, 03:00 UTC
--     $$ SELECT ops.ensure_monthly_partitions(3) $$
--   );
--
-- Em dev/staging: rodar manualmente quando necessário:
--   SELECT * FROM ops.ensure_monthly_partitions(6);
