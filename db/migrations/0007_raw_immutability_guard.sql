-- ============================================================
-- 0007_raw_immutability_guard.sql
-- Enforce imutabilidade de raw.raw_events no nível do banco.
--
-- Antes: "imutável após INSERT" era só convenção verbal; qualquer
-- cliente com a role padrão podia UPDATE payload ou DELETE linhas.
-- Depois: trigger barra UPDATE em colunas não-operacionais e
-- barra DELETE irrestrito. Apenas processing_status,
-- processing_error e processed_at podem ser tocados.
-- ============================================================

-- ------------------------------------------------------------
-- Função do guard de imutabilidade
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION raw.enforce_raw_event_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Bloqueia DELETE em raw.raw_events.
  -- Apagamento de auditoria requer procedure dedicada com role especial;
  -- não deve acontecer via ORM/aplicação comum.
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'raw.raw_events é imutável: DELETE não permitido (id=%). '
      'Para erasure por LGPD use procedure raw.erase_event_for_compliance().',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Bloqueia UPDATE em colunas de identidade/auditoria.
  -- Whitelist: processing_status, processing_error, processed_at.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.id                    IS DISTINCT FROM NEW.id                    OR
       OLD.environment           IS DISTINCT FROM NEW.environment           OR
       OLD.chatwoot_delivery_id  IS DISTINCT FROM NEW.chatwoot_delivery_id  OR
       OLD.chatwoot_signature    IS DISTINCT FROM NEW.chatwoot_signature     OR
       OLD.chatwoot_timestamp    IS DISTINCT FROM NEW.chatwoot_timestamp     OR
       OLD.received_at           IS DISTINCT FROM NEW.received_at           OR
       OLD.event_type            IS DISTINCT FROM NEW.event_type            OR
       OLD.account_id            IS DISTINCT FROM NEW.account_id            OR
       OLD.payload               IS DISTINCT FROM NEW.payload
    THEN
      RAISE EXCEPTION
        'raw.raw_events é imutável: tentativa de alterar coluna protegida em id=%. '
        'Apenas processing_status, processing_error e processed_at podem ser atualizados.',
        OLD.id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION raw.enforce_raw_event_immutability IS
  'Guard de imutabilidade de raw.raw_events. Bloqueia UPDATE em colunas de identidade/payload e bloqueia DELETE. Somente processing_status, processing_error e processed_at são permitidos em UPDATE.';

-- ------------------------------------------------------------
-- Aplica o trigger na tabela pai (propaga para todas as partições)
-- Postgres 11+: triggers em tabela particionada são herdados.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS raw_events_immutability_guard ON raw.raw_events;
CREATE TRIGGER raw_events_immutability_guard
  BEFORE UPDATE OR DELETE ON raw.raw_events
  FOR EACH ROW EXECUTE FUNCTION raw.enforce_raw_event_immutability();

COMMENT ON TRIGGER raw_events_immutability_guard ON raw.raw_events IS
  'Enforce de imutabilidade: bloqueia UPDATE em colunas não-operacionais e bloqueia DELETE. Ver raw.enforce_raw_event_immutability().';
