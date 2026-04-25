-- ============================================================
-- 0008_idempotency_constraints.sql
-- Fecha race condition em conversation_status_events e
-- conversation_assignments.
--
-- Problema: dedup era feito 100% no app via WHERE NOT EXISTS.
-- Sob READ COMMITTED, dois workers concorrentes podem passar
-- o NOT EXISTS simultaneamente e inserir duplicata.
--
-- Solução: UNIQUE constraint no banco, que é atômica.
-- O WHERE NOT EXISTS no repo fica como defesa-em-profundidade.
-- O app passa a usar ON CONFLICT DO NOTHING implicitamente
-- via a constraint — sem alterar código existente.
--
-- Dedup script roda ANTES de adicionar as constraints para
-- não quebrar em ambientes com duplicatas pré-existentes.
-- ============================================================

-- ------------------------------------------------------------
-- (1) conversation_status_events
-- Chave natural de idempotência:
--   (environment, chatwoot_conversation_id, event_type, occurred_at)
-- Mesma conversa não pode ter o mesmo tipo de evento exatamente
-- ao mesmo timestamp — isso seria replay do mesmo raw_event.
-- ------------------------------------------------------------

-- Remove duplicatas mantendo a linha criada primeiro (created_at menor).
-- Se created_at for igual, mantém o UUID menor (determinístico).
DELETE FROM core.conversation_status_events
WHERE id NOT IN (
  SELECT DISTINCT ON (environment, chatwoot_conversation_id, event_type, occurred_at) id
  FROM core.conversation_status_events
  ORDER BY environment, chatwoot_conversation_id, event_type, occurred_at, created_at, id
);

-- Adiciona a constraint. Idempotente via IF NOT EXISTS no índice.
ALTER TABLE core.conversation_status_events
  DROP CONSTRAINT IF EXISTS status_events_dedup_key;

ALTER TABLE core.conversation_status_events
  ADD CONSTRAINT status_events_dedup_key
  UNIQUE (environment, chatwoot_conversation_id, event_type, occurred_at);

COMMENT ON CONSTRAINT status_events_dedup_key ON core.conversation_status_events IS
  'Garante idempotência atômica. O app também usa WHERE NOT EXISTS como defesa-em-profundidade, mas só isso não basta sob concorrência (READ COMMITTED permite race). Com a constraint, o segundo INSERT falha com ON CONFLICT.';

-- ------------------------------------------------------------
-- (2) conversation_assignments
-- Chave natural:
--   (environment, conversation_id, agent_id, assigned_at)
-- Mesma conversa não pode ter o mesmo agente atribuído duas vezes
-- ao mesmo timestamp — seria replay.
-- ------------------------------------------------------------

-- Remove duplicatas mantendo a linha com handoff_number menor.
-- Se igual, mantém o UUID menor.
DELETE FROM core.conversation_assignments
WHERE id NOT IN (
  SELECT DISTINCT ON (environment, conversation_id, agent_id, assigned_at) id
  FROM core.conversation_assignments
  ORDER BY environment, conversation_id, agent_id, assigned_at, handoff_number, id
);

ALTER TABLE core.conversation_assignments
  DROP CONSTRAINT IF EXISTS assignments_dedup_key;

ALTER TABLE core.conversation_assignments
  ADD CONSTRAINT assignments_dedup_key
  UNIQUE (environment, conversation_id, agent_id, assigned_at);

COMMENT ON CONSTRAINT assignments_dedup_key ON core.conversation_assignments IS
  'Garante idempotência atômica para assignments. Mesmo agente não pode ser atribuído à mesma conversa duas vezes no mesmo timestamp.';
