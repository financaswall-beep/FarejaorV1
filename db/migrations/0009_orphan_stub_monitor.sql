-- ============================================================
-- 0009_orphan_stub_monitor.sql
-- Detecta conversas-fantasma criadas quando message_created chegou
-- antes de conversation_created e o evento de criação nunca veio.
--
-- Stub: linha em core.conversations com last_event_at IS NULL.
-- Isso acontece porque upsertMessage cria a conversa com
-- last_event_at = NULL para não competir com o watermark trigger.
-- Quando conversation_created chega depois, o trigger aceita e
-- preenche last_event_at. Se nunca chegar, a conversa fica orphã.
--
-- Este módulo:
--   1. View ops.orphan_conversation_stubs — visibilidade imediata.
--   2. Função ops.report_orphan_stubs() — para cron/pg_cron.
--
-- Para alertas: agende via pg_cron chamando ops.report_orphan_stubs()
-- e monitore o resultado em logs do Supabase ou tabela de alertas.
-- ============================================================

-- ------------------------------------------------------------
-- View: lista stubs com mais de 10 minutos sem resolução
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW ops.orphan_conversation_stubs AS
SELECT
  c.id,
  c.environment,
  c.chatwoot_conversation_id,
  c.chatwoot_account_id,
  c.started_at,
  c.created_at,
  now() - c.created_at AS age,
  c.current_status
FROM core.conversations c
WHERE c.last_event_at IS NULL
  AND c.created_at < now() - INTERVAL '10 minutes'
  AND c.deleted_at IS NULL;

COMMENT ON VIEW ops.orphan_conversation_stubs IS
  'Conversas stub criadas por message_created sem conversation_created subsequente. '
  'last_event_at IS NULL indica que o evento de criação nunca normalizou a conversa. '
  'Stubs com mais de 10 minutos provavelmente não receberão o conversation_created. '
  'Acionar /admin/reconcile para a janela correspondente resolve o problema.';

-- ------------------------------------------------------------
-- Função: retorna contagem e lista dos stubs para cron/alertas
-- Uso: SELECT * FROM ops.report_orphan_stubs();
-- Agendar: SELECT cron.schedule('farejador-orphan-check', '*/30 * * * *',
--           $$ SELECT ops.report_orphan_stubs() $$);
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops.report_orphan_stubs(
  p_min_age_minutes INTEGER DEFAULT 10,
  p_environment     env_t   DEFAULT NULL
)
RETURNS TABLE (
  environment              env_t,
  orphan_count             BIGINT,
  oldest_stub_created_at   TIMESTAMPTZ,
  newest_stub_created_at   TIMESTAMPTZ,
  chatwoot_conv_ids        BIGINT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.environment,
    COUNT(*)::BIGINT,
    MIN(c.created_at),
    MAX(c.created_at),
    ARRAY_AGG(c.chatwoot_conversation_id ORDER BY c.created_at)
  FROM core.conversations c
  WHERE c.last_event_at IS NULL
    AND c.created_at < now() - (p_min_age_minutes || ' minutes')::INTERVAL
    AND c.deleted_at IS NULL
    AND (p_environment IS NULL OR c.environment = p_environment)
  GROUP BY c.environment;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION ops.report_orphan_stubs IS
  'Retorna contagem de conversas-stub por environment. Agendar via pg_cron a cada 30 minutos. '
  'Se orphan_count > 0, acionar POST /admin/reconcile com janela cobrindo o período dos stubs.';
