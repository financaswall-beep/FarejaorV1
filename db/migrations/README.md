# Migrations — Farejador

Ordem de execução:

1. `0001_init_schemas.sql` — extensions (pgcrypto, pg_trgm, btree_gin), schemas (raw/core/analytics/ops), domínio `env_t`
2. `0002_raw_layer.sql` — `raw.raw_events` particionada mensalmente
3. `0003_core_layer.sql` — contacts, conversations, messages (particionada), attachments, tags, status_events, assignments, reactions
4. `0004_analytics_layer.sql` — conversation_facts (EAV com proveniência), signals, classifications, customer_journey, linguistic_hints
5. `0005_ops_layer.sql` — stock_snapshots, enrichment_jobs, bot_events, erasure_log + `ops.anonymize_contact()`
6. `0006_concurrency_guards.sql` — `raw.delivery_seen` (bouncer dedup), `last_event_at` + trigger watermark em core, helper `ops.ensure_monthly_partitions()`

## Convenções

- Toda tabela tem coluna `environment` (prod/test) via domínio `env_t`
- Idempotência: webhooks usam `raw.delivery_seen (environment, chatwoot_delivery_id)` como bouncer; normalizadas usam `(environment, chatwoot_<entity>_id)`
- Soft-delete via `deleted_at` em contacts/conversations/messages (LGPD)
- Proveniência (truth_type/source/confidence_level/extractor_version) só em `analytics.*`
- FKs cross-schema e para tabelas particionadas são **lógicas** (validadas no ETL, não pelo Postgres)
- TEXT + CHECK em taxonomias voláteis. Promover a ENUM só após 4-8 semanas de dados estáveis

## População por fase

O projeto evolui em 3 fases. Responsabilidades **não** atravessam fronteira de fase.

### Fase 1 — Farejador determinístico (MVP, semanas 1-4)
**Runtime**: serviço Fastify recebendo webhook do Chatwoot.
**Popula**:
- `raw.raw_events` (via bouncer `raw.delivery_seen`)
- `core.contacts`, `core.conversations`, `core.messages`, `core.message_attachments`
- `core.conversation_tags`, `core.conversation_status_events`, `core.conversation_assignments`, `core.message_reactions`
- `ops.erasure_log` (quando houver solicitação LGPD)

**Não popula**: nada em `analytics.*`. `ops.enrichment_jobs`, `ops.stock_snapshots` e `ops.bot_events` permanecem vazias.

**Regra invariante**: zero LLM no runtime. Mapeamento payload → tabelas é 100% determinístico.

### Fase 2a — Enrichment determinístico (semanas 3-6, em paralelo ao final da Fase 1)
**Runtime**: workers async consumindo `ops.enrichment_jobs` com `FOR UPDATE SKIP LOCKED`.
**Popula**:
- `analytics.conversation_signals` via agregação SQL pura (latências, counts, handoff_count)
- `analytics.linguistic_hints` via regex e heurística (sem LLM)
- `analytics.customer_journey` básico (contagem de conversas, canal, migração entre canais)
- `analytics.conversation_classifications` para regras manuais determinísticas (ex: tag `oferta_enviada` → `stage_reached='cotacao'`)

**Propósito**: baseline barato e recomputável. Existe antes da Fase 2b para permitir medir o ganho real do LLM.

### Fase 2b — Enrichment com LLM (mês 2-3)
**Runtime**: worker async separado. Lê conversas de `ops.enrichment_jobs`, chama LLM com prompt versionado.
**Popula**:
- `analytics.conversation_facts` (produto, medida, marca, preço cotado, frete, bairro, motivo de perda)
- `analytics.conversation_classifications` (`stage_reached`, `final_outcome`, `loss_reason` via classificador LLM)
- Transcrição de áudio (Whisper ou similar) → `core.message_attachments.transcription_available = true` + `analytics.conversation_facts` com `fact_key='audio_transcription'`

**Invariantes obrigatórias (toda linha escrita em `analytics.*`)**:
- `source` preenchido (ex: `llm_gpt4o_v3`, `whisper_v2`)
- `extractor_version` preenchido (bumpa quando mudar prompt)
- `confidence_level` entre 0 e 1
- `truth_type` em `('observed', 'inferred', 'predicted', 'corrected')`
- Correção = nova linha com `superseded_by` apontando pra antiga. **Nunca UPDATE**.

**LLM nunca escreve em `raw.*` ou `core.*`**. Se precisar, abre um `ops.enrichment_jobs` para humano revisar.

### Fase 3 — Agente atendente (serviço separado, mês 4+)
Container próprio, runtime próprio. Lê `core.*` e `analytics.*` como cliente read-only. Não faz parte das migrations deste repo — consome a base estruturada que as fases 1-2b produziram.

### Fase 4 — Fora do plano ativo
Treinar LLM próprio a partir do dataset capturado permanece apenas como possibilidade de roadmap distante. Não planejar, não pré-otimizar para isso.

## Extensão de partições

As migrations criam partições iniciais até 2026-06. A migration `0006` adiciona o helper `ops.ensure_monthly_partitions(p_months_ahead)` que cria partições mensais para `raw.raw_events` e `core.messages` de forma idempotente.

**Dev/staging** — rode quando precisar:
```sql
SELECT * FROM ops.ensure_monthly_partitions(6);
```

**Produção** — agende via `pg_cron` (disponível no Supabase):
```sql
SELECT cron.schedule(
  'farejador-ensure-partitions',
  '0 3 20 * *',
  $$ SELECT ops.ensure_monthly_partitions(3) $$
);
```

Alternativa industrial: instalar `pg_partman` para gestão automática com retenção/detach. Para o volume atual, o helper é suficiente.

## Concorrência — regras obrigatórias do ETL

### 1. Dedup de webhook (retry do Chatwoot)
Antes de inserir em `raw.raw_events`, reivindicar o `delivery_id` em `raw.delivery_seen`:

```sql
WITH claim AS (
  INSERT INTO raw.delivery_seen (environment, chatwoot_delivery_id)
  VALUES ($1, $2)
  ON CONFLICT DO NOTHING
  RETURNING 1
)
INSERT INTO raw.raw_events (environment, chatwoot_delivery_id, ...)
SELECT $1, $2, ... WHERE EXISTS (SELECT 1 FROM claim);
```

Se `claim` vier vazio, webhook é duplicata. Responde 200 pro Chatwoot sem tocar em nada.

### 2. Watermark de ordem em `core.*`
Todo upsert em `core.contacts`, `core.conversations`, `core.messages` **deve** passar `last_event_at` (= `X-Chatwoot-Timestamp` ou `payload.updated_at`). O trigger `core.skip_stale_update` converte em no-op qualquer UPDATE com watermark menor.

Redundância defensiva recomendada no SQL da aplicação:
```sql
INSERT INTO core.conversations (..., last_event_at) VALUES (..., $N)
ON CONFLICT (environment, chatwoot_conversation_id) DO UPDATE
SET ..., last_event_at = EXCLUDED.last_event_at
WHERE EXCLUDED.last_event_at >= core.conversations.last_event_at;
```

### 3. Workers de `ops.enrichment_jobs`
**Obrigatório** `FOR UPDATE SKIP LOCKED` no pull:

```sql
SELECT id, target_type, target_id, job_type
FROM ops.enrichment_jobs
WHERE status = 'queued' AND scheduled_at <= now()
ORDER BY priority, scheduled_at
LIMIT 10
FOR UPDATE SKIP LOCKED;
```

Sem `SKIP LOCKED`, dois workers em paralelo processam o mesmo job — custo real em chamadas LLM.

### 4. Upsert de agregados analíticos
`analytics.conversation_signals` e `analytics.customer_journey` são recomputados. Upsert deve preservar `computed_at` mais recente:

```sql
ON CONFLICT (conversation_id) DO UPDATE
SET computed_at = GREATEST(conversation_signals.computed_at, EXCLUDED.computed_at),
    ... = CASE WHEN EXCLUDED.computed_at >= conversation_signals.computed_at
               THEN EXCLUDED.... ELSE conversation_signals.... END;
```

## Anonimização LGPD

```sql
SELECT ops.anonymize_contact(
  p_contact_id   => '<uuid>',
  p_requested_by => 'cliente_via_whatsapp',
  p_executed_by  => 'sistema_automatico',
  p_reason       => 'solicitação formal direito ao esquecimento'
);
```

Zera PII do contato, mantém agregados, registra em `ops.erasure_log`.
