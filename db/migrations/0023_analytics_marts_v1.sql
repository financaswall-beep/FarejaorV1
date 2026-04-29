-- ============================================================
-- 0023_analytics_marts_v1.sql
-- Fase 3: camada inicial de BI ("rei dos dados").
--
-- Esta migration NAO altera raw.*, core.* nem analytics.* operacional.
-- Ela cria apenas views derivadas em analytics_marts.*, lendo fatos atuais,
-- mensagens, conversas, jobs e incidentes.
--
-- Objetivo: transformar conversas/fatos em perguntas de negocio:
--   - quais pneus sao mais procurados?
--   - quais bairros/municipios procuram mais?
--   - quais horarios concentram demanda?
--   - onde ha objecao de preco/desconto?
--   - quais concorrentes aparecem?
--   - a Organizadora esta saudavel?
-- ============================================================

CREATE SCHEMA IF NOT EXISTS analytics_marts;

COMMENT ON SCHEMA analytics_marts IS
  'Views e resumos de BI derivados de core.*, analytics.* e ops.*. Nao e fonte operacional; e camada de leitura para auditoria, relatorio e dashboard.';

-- ------------------------------------------------------------
-- Helper: jsonb primitivo -> texto legivel
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_marts.fact_value_text(p_value JSONB)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE jsonb_typeof(p_value)
    WHEN 'string' THEN p_value #>> '{}'
    WHEN 'number' THEN p_value #>> '{}'
    WHEN 'boolean' THEN p_value #>> '{}'
    WHEN 'null' THEN NULL
    ELSE COALESCE(
      p_value ->> 'text',
      p_value ->> 'value',
      p_value ->> 'name',
      p_value ->> 'label',
      p_value::TEXT
    )
  END
$$;

COMMENT ON FUNCTION analytics_marts.fact_value_text(JSONB) IS
  'Normaliza fact_value JSONB para texto. Suporta string/number/boolean e objetos antigos com text/value/name/label.';

-- ------------------------------------------------------------
-- Base canonica: uma linha por conversa, facts atuais em colunas
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics_marts.conversation_fact_pivot AS
WITH facts AS (
  SELECT
    cf.environment,
    cf.conversation_id,
    cf.fact_key,
    analytics_marts.fact_value_text(cf.fact_value) AS fact_value_text,
    cf.confidence_level,
    cf.created_at
  FROM analytics.current_facts cf
)
SELECT
  c.environment,
  c.id AS conversation_id,
  c.chatwoot_conversation_id,
  c.contact_id,
  c.channel_type,
  c.started_at,
  (c.started_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS started_date_local,
  EXTRACT(HOUR FROM c.started_at AT TIME ZONE 'America/Sao_Paulo')::SMALLINT AS started_hour_local,
  EXTRACT(DOW FROM c.started_at AT TIME ZONE 'America/Sao_Paulo')::SMALLINT AS started_dow_local,

  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'nome_cliente') AS nome_cliente,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'moto_marca') AS moto_marca,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'moto_modelo') AS moto_modelo,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'moto_ano') AS moto_ano,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'moto_cilindrada') AS moto_cilindrada,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'moto_uso') AS moto_uso,

  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'medida_pneu') AS medida_pneu,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'posicao_pneu') AS posicao_pneu,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'marca_pneu_preferida') AS marca_pneu_preferida,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'marca_pneu_recusada') AS marca_pneu_recusada,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'quantidade_pneus') AS quantidade_pneus,

  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'intencao_cliente') AS intencao_cliente,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'motivo_compra') AS motivo_compra,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'urgencia') AS urgencia,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'preferencia_principal') AS preferencia_principal,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'faixa_preco_desejada') AS faixa_preco_desejada,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'aceita_alternativa') AS aceita_alternativa,

  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'bairro_mencionado') AS bairro_mencionado,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'municipio_mencionado') AS municipio_mencionado,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'modalidade_entrega') AS modalidade_entrega,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'perguntou_entrega_hoje') AS perguntou_entrega_hoje,

  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'forma_pagamento') AS forma_pagamento,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'pediu_desconto') AS pediu_desconto,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'perguntou_parcelamento') AS perguntou_parcelamento,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'achou_caro') AS achou_caro,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'concorrente_citado') AS concorrente_citado,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'preco_concorrente') AS preco_concorrente,

  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'produto_oferecido') AS produto_oferecido,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'produto_aceito') AS produto_aceito,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'produto_recusado_motivo') AS produto_recusado_motivo,
  MAX(f.fact_value_text) FILTER (WHERE f.fact_key = 'pediu_humano') AS pediu_humano,

  COUNT(f.fact_key) AS total_current_facts,
  AVG(f.confidence_level) AS avg_confidence_level
FROM core.conversations c
LEFT JOIN facts f
  ON f.environment = c.environment
 AND f.conversation_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY
  c.environment,
  c.id,
  c.chatwoot_conversation_id,
  c.contact_id,
  c.channel_type,
  c.started_at;

COMMENT ON VIEW analytics_marts.conversation_fact_pivot IS
  'Uma linha por conversa com os facts atuais da Organizadora em colunas. Base para os marts de BI.';

-- ------------------------------------------------------------
-- Demanda diaria por pneu
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics_marts.daily_demand_by_tire AS
SELECT
  environment,
  started_date_local,
  COALESCE(medida_pneu, '(medida_nao_informada)') AS medida_pneu,
  COALESCE(posicao_pneu, '(posicao_nao_informada)') AS posicao_pneu,
  COALESCE(moto_modelo, '(moto_nao_informada)') AS moto_modelo,
  COUNT(*) AS conversation_count,
  COUNT(DISTINCT contact_id) FILTER (WHERE contact_id IS NOT NULL) AS unique_contacts,
  COUNT(*) FILTER (WHERE urgencia = 'alta') AS high_urgency_count,
  COUNT(*) FILTER (WHERE produto_aceito = 'true') AS accepted_offer_count,
  COUNT(*) FILTER (WHERE achou_caro = 'true') AS price_objection_count
FROM analytics_marts.conversation_fact_pivot
WHERE medida_pneu IS NOT NULL
   OR moto_modelo IS NOT NULL
GROUP BY environment, started_date_local, medida_pneu, posicao_pneu, moto_modelo;

COMMENT ON VIEW analytics_marts.daily_demand_by_tire IS
  'Demanda diaria por medida/posicao/moto. Responde: quais pneus e motos aparecem mais?';

-- ------------------------------------------------------------
-- Demanda diaria por bairro/municipio
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics_marts.daily_demand_by_neighborhood AS
SELECT
  environment,
  started_date_local,
  COALESCE(municipio_mencionado, '(municipio_nao_informado)') AS municipio_mencionado,
  COALESCE(bairro_mencionado, '(bairro_nao_informado)') AS bairro_mencionado,
  COUNT(*) AS conversation_count,
  COUNT(DISTINCT contact_id) FILTER (WHERE contact_id IS NOT NULL) AS unique_contacts,
  COUNT(*) FILTER (WHERE medida_pneu IS NOT NULL OR moto_modelo IS NOT NULL) AS product_search_count,
  COUNT(*) FILTER (WHERE perguntou_entrega_hoje = 'true') AS same_day_delivery_questions,
  COUNT(*) FILTER (WHERE achou_caro = 'true') AS price_objection_count
FROM analytics_marts.conversation_fact_pivot
WHERE municipio_mencionado IS NOT NULL
   OR bairro_mencionado IS NOT NULL
GROUP BY environment, started_date_local, municipio_mencionado, bairro_mencionado;

COMMENT ON VIEW analytics_marts.daily_demand_by_neighborhood IS
  'Demanda diaria por municipio/bairro. Responde: de onde vem a procura?';

-- ------------------------------------------------------------
-- Horario de pico por cidade/bairro
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics_marts.hourly_demand_by_city AS
SELECT
  environment,
  started_dow_local,
  started_hour_local,
  COALESCE(municipio_mencionado, '(municipio_nao_informado)') AS municipio_mencionado,
  COALESCE(bairro_mencionado, '(bairro_nao_informado)') AS bairro_mencionado,
  COUNT(*) AS conversation_count,
  COUNT(DISTINCT contact_id) FILTER (WHERE contact_id IS NOT NULL) AS unique_contacts,
  COUNT(*) FILTER (WHERE medida_pneu IS NOT NULL OR moto_modelo IS NOT NULL) AS product_search_count
FROM analytics_marts.conversation_fact_pivot
GROUP BY environment, started_dow_local, started_hour_local, municipio_mencionado, bairro_mencionado;

COMMENT ON VIEW analytics_marts.hourly_demand_by_city IS
  'Demanda por dia da semana, hora, municipio e bairro. Responde: quando cada regiao chama mais?';

-- ------------------------------------------------------------
-- Objecoes de preco/desconto
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics_marts.daily_price_objections AS
SELECT
  environment,
  started_date_local,
  COALESCE(municipio_mencionado, '(municipio_nao_informado)') AS municipio_mencionado,
  COALESCE(bairro_mencionado, '(bairro_nao_informado)') AS bairro_mencionado,
  COALESCE(medida_pneu, '(medida_nao_informada)') AS medida_pneu,
  COUNT(*) FILTER (WHERE achou_caro = 'true') AS achou_caro_count,
  COUNT(*) FILTER (WHERE pediu_desconto = 'true') AS pediu_desconto_count,
  COUNT(*) FILTER (WHERE perguntou_parcelamento = 'true') AS perguntou_parcelamento_count,
  COUNT(*) FILTER (WHERE preco_concorrente IS NOT NULL) AS competitor_price_count,
  AVG(
    CASE
      WHEN preco_concorrente ~ '^[0-9]+([.,][0-9]+)?$'
      THEN replace(preco_concorrente, ',', '.')::NUMERIC
      ELSE NULL
    END
  ) AS avg_competitor_price
FROM analytics_marts.conversation_fact_pivot
WHERE achou_caro = 'true'
   OR pediu_desconto = 'true'
   OR perguntou_parcelamento = 'true'
   OR preco_concorrente IS NOT NULL
GROUP BY environment, started_date_local, municipio_mencionado, bairro_mencionado, medida_pneu;

COMMENT ON VIEW analytics_marts.daily_price_objections IS
  'Resumo diario de objecoes comerciais: caro, desconto, parcelamento e preco de concorrente.';

-- ------------------------------------------------------------
-- Concorrentes citados
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics_marts.daily_competitor_mentions AS
SELECT
  environment,
  started_date_local,
  COALESCE(concorrente_citado, '(concorrente_nao_nomeado)') AS concorrente_citado,
  COALESCE(medida_pneu, '(medida_nao_informada)') AS medida_pneu,
  COUNT(*) AS mention_count,
  COUNT(DISTINCT contact_id) FILTER (WHERE contact_id IS NOT NULL) AS unique_contacts,
  AVG(
    CASE
      WHEN preco_concorrente ~ '^[0-9]+([.,][0-9]+)?$'
      THEN replace(preco_concorrente, ',', '.')::NUMERIC
      ELSE NULL
    END
  ) AS avg_competitor_price
FROM analytics_marts.conversation_fact_pivot
WHERE concorrente_citado IS NOT NULL
   OR preco_concorrente IS NOT NULL
GROUP BY environment, started_date_local, concorrente_citado, medida_pneu;

COMMENT ON VIEW analytics_marts.daily_competitor_mentions IS
  'Concorrentes e precos citados por dia/medida. Responde: quem aparece contra a loja?';

-- ------------------------------------------------------------
-- Intencao do cliente por dia
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics_marts.daily_customer_intent AS
SELECT
  environment,
  started_date_local,
  COALESCE(intencao_cliente, '(intencao_nao_informada)') AS intencao_cliente,
  COALESCE(motivo_compra, '(motivo_nao_informado)') AS motivo_compra,
  COALESCE(urgencia, '(urgencia_nao_informada)') AS urgencia,
  COUNT(*) AS conversation_count,
  COUNT(DISTINCT contact_id) FILTER (WHERE contact_id IS NOT NULL) AS unique_contacts,
  COUNT(*) FILTER (WHERE produto_aceito = 'true') AS accepted_offer_count,
  COUNT(*) FILTER (WHERE pediu_humano = 'true') AS asked_human_count
FROM analytics_marts.conversation_fact_pivot
WHERE intencao_cliente IS NOT NULL
   OR motivo_compra IS NOT NULL
   OR urgencia IS NOT NULL
GROUP BY environment, started_date_local, intencao_cliente, motivo_compra, urgencia;

COMMENT ON VIEW analytics_marts.daily_customer_intent IS
  'Intencao, motivo e urgencia por dia. Responde: por que o cliente chamou?';

-- ------------------------------------------------------------
-- Qualidade diaria da Organizadora
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics_marts.organizadora_quality_daily AS
WITH job_daily AS (
  SELECT
    environment,
    (created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS day_local,
    COUNT(*) AS job_count,
    COUNT(*) FILTER (WHERE status IN ('processed', 'done')) AS completed_job_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_job_count,
    COUNT(DISTINCT conversation_id) FILTER (WHERE conversation_id IS NOT NULL) AS conversations_enqueued
  FROM ops.enrichment_jobs
  WHERE job_type IN ('organize_conversation', 'reenrich_conversation', 'fact_extraction')
  GROUP BY environment, (created_at AT TIME ZONE 'America/Sao_Paulo')::DATE
),
fact_daily AS (
  SELECT
    f.environment,
    (f.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS day_local,
    COUNT(*) AS facts_created,
    COUNT(e.id) AS evidences_created
  FROM analytics.conversation_facts f
  LEFT JOIN analytics.fact_evidence e
    ON e.environment = f.environment
   AND e.fact_id = f.id
  WHERE f.source = 'llm_openai_organizadora_v1'
  GROUP BY f.environment, (f.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE
),
incident_daily AS (
  SELECT
    environment,
    (created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS day_local,
    COUNT(*) AS incident_count,
    COUNT(*) FILTER (WHERE incident_type = 'schema_violation') AS schema_violation_count,
    COUNT(*) FILTER (WHERE incident_type = 'evidence_not_literal') AS evidence_not_literal_count,
    COUNT(*) FILTER (WHERE incident_type IN ('llm_timeout', 'llm_api_error')) AS llm_error_count
  FROM ops.agent_incidents
  GROUP BY environment, (created_at AT TIME ZONE 'America/Sao_Paulo')::DATE
),
days AS (
  SELECT environment, day_local FROM job_daily
  UNION
  SELECT environment, day_local FROM fact_daily
  UNION
  SELECT environment, day_local FROM incident_daily
)
SELECT
  d.environment,
  d.day_local,
  COALESCE(j.job_count, 0) AS job_count,
  COALESCE(j.completed_job_count, 0) AS completed_job_count,
  COALESCE(j.failed_job_count, 0) AS failed_job_count,
  COALESCE(j.conversations_enqueued, 0) AS conversations_enqueued,
  COALESCE(f.facts_created, 0) AS facts_created,
  COALESCE(f.evidences_created, 0) AS evidences_created,
  COALESCE(i.incident_count, 0) AS incident_count,
  COALESCE(i.schema_violation_count, 0) AS schema_violation_count,
  COALESCE(i.evidence_not_literal_count, 0) AS evidence_not_literal_count,
  COALESCE(i.llm_error_count, 0) AS llm_error_count
FROM days d
LEFT JOIN job_daily j
  ON j.environment = d.environment
 AND j.day_local = d.day_local
LEFT JOIN fact_daily f
  ON f.environment = d.environment
 AND f.day_local = d.day_local
LEFT JOIN incident_daily i
  ON i.environment = d.environment
 AND i.day_local = d.day_local;

COMMENT ON VIEW analytics_marts.organizadora_quality_daily IS
  'Saude diaria da Organizadora: jobs, facts, evidencias e incidentes. Primeira tela para auditar qualidade do Shadow Assistido.';
