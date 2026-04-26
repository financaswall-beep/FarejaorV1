-- ============================================================
-- 0011_relax_hint_type_check.sql
-- Remove o CHECK fechado em analytics.linguistic_hints.hint_type
-- para permitir extensibilidade por segmento (F2A-05 e diante).
--
-- Motivacao:
-- O CHECK original aceitava apenas 7 valores hardcoded
-- ('negative_keyword', 'repetition', 'price_complaint',
--  'urgency_marker', 'abandonment_marker', 'positive_marker',
--  'competitor_mention'). Qualquer segmento que introduzisse um
-- novo hint_type (ex.: tire_size_mentioned, financing_request)
-- falharia com 23514 mesmo respeitando provenance e ruleset_hash.
--
-- Consistencia: 'source' e 'extractor_version' ja sao TEXT livres.
-- 'hint_type' passa a seguir o mesmo padrao.
--
-- Convencao (documentada em docs/F2A_ARCHITECTURE.md):
-- - hint_types genericos vivem em segments/generic/rules.json;
-- - hint_types de segmento usam prefixo namespaced quando o termo
--   so faz sentido naquele segmento (ex.: tire_size_mentioned).
-- ============================================================

ALTER TABLE analytics.linguistic_hints
  DROP CONSTRAINT IF EXISTS linguistic_hints_hint_type_check;

COMMENT ON COLUMN analytics.linguistic_hints.hint_type IS
  'Tipo do hint. TEXT livre (sem CHECK fechado) para permitir vocabulario por segmento. Genericos vivem em segments/generic; especificos podem usar prefixo namespaced (ex.: tire_size_mentioned).';
