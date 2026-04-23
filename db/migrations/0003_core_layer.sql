-- ============================================================
-- 0003_core_layer.sql
-- Camada CORE: normalização 1:1 do Chatwoot. Sem interpretação.
-- Idempotência via (environment, chatwoot_*_id) em toda tabela.
-- Soft-delete via deleted_at (LGPD). FKs cross-schema são lógicas (não enforced em particionadas).
-- ============================================================

-- ------------------------------------------------------------
-- contacts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         env_t       NOT NULL,
  chatwoot_contact_id BIGINT      NOT NULL,
  name                TEXT,
  phone_e164          TEXT,       -- normalizado p/ E.164 no ETL (+5521...)
  email               TEXT,
  identifier          TEXT,       -- "identifier" custom do Chatwoot
  channel_type        TEXT,       -- whatsapp / instagram / facebook / web
  country             TEXT,
  city                TEXT,
  custom_attributes   JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at       TIMESTAMPTZ,
  last_seen_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ, -- soft-delete LGPD (ver ops.erasure_log)
  UNIQUE (environment, chatwoot_contact_id)
);

COMMENT ON TABLE  core.contacts              IS 'Contatos do Chatwoot. Soft-delete via deleted_at quando houver direito de apagamento.';
COMMENT ON COLUMN core.contacts.phone_e164   IS 'Telefone normalizado E.164 no ETL. Null se payload veio sem telefone.';
COMMENT ON COLUMN core.contacts.identifier   IS 'Campo identifier custom do Chatwoot (ex: ID externo da loja).';

CREATE INDEX IF NOT EXISTS contacts_phone_idx
  ON core.contacts (phone_e164) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS contacts_custom_attrs_gin
  ON core.contacts USING GIN (custom_attributes jsonb_path_ops);

-- ------------------------------------------------------------
-- conversations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.conversations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment                 env_t       NOT NULL,
  chatwoot_conversation_id    BIGINT      NOT NULL,
  chatwoot_account_id         INTEGER     NOT NULL,
  chatwoot_inbox_id           INTEGER,
  channel_type                TEXT,                 -- whatsapp/instagram/facebook/web
  contact_id                  UUID REFERENCES core.contacts(id) ON DELETE SET NULL,
  current_status              TEXT        NOT NULL
                              CHECK (current_status IN ('open', 'resolved', 'pending', 'snoozed')),
  current_assignee_id         BIGINT,               -- agent id do Chatwoot
  current_team_id             BIGINT,
  priority                    TEXT CHECK (priority IN ('low','medium','high','urgent') OR priority IS NULL),
  started_at                  TIMESTAMPTZ NOT NULL,
  first_reply_at              TIMESTAMPTZ,
  last_activity_at            TIMESTAMPTZ,
  resolved_at                 TIMESTAMPTZ,
  waiting_since               TIMESTAMPTZ,
  message_count_cache         INTEGER     NOT NULL DEFAULT 0, -- atualizado via ETL, evita COUNT em messages particionada
  additional_attributes       JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_attributes           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                  TIMESTAMPTZ,
  UNIQUE (environment, chatwoot_conversation_id)
);

COMMENT ON COLUMN core.conversations.message_count_cache IS 'Contador denormalizado. Atualizado via ETL ao processar message_created.';
COMMENT ON COLUMN core.conversations.contact_id          IS 'SET NULL ao apagar contato (LGPD preserva conversa anonimizada).';

CREATE INDEX IF NOT EXISTS conversations_contact_idx
  ON core.conversations (contact_id);

CREATE INDEX IF NOT EXISTS conversations_status_idx
  ON core.conversations (environment, current_status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS conversations_started_brin
  ON core.conversations USING BRIN (started_at);

CREATE INDEX IF NOT EXISTS conversations_channel_idx
  ON core.conversations (channel_type);

-- ------------------------------------------------------------
-- messages (particionada por sent_at — volume alto)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.messages (
  id                        UUID        NOT NULL DEFAULT gen_random_uuid(),
  environment               env_t       NOT NULL,
  chatwoot_message_id       BIGINT      NOT NULL,
  conversation_id           UUID        NOT NULL,  -- FK lógica (cross-schema + particionada)
  chatwoot_conversation_id  BIGINT      NOT NULL,
  sender_type               TEXT        NOT NULL
                            CHECK (sender_type IN ('contact', 'user', 'agent_bot', 'system')),
  sender_id                 BIGINT,                -- id do agente ou contato no Chatwoot
  message_type              SMALLINT    NOT NULL, -- enum nativo Chatwoot (ver coluna derivada abaixo)
  message_type_name         TEXT        GENERATED ALWAYS AS (
                              CASE message_type
                                WHEN 0 THEN 'incoming'
                                WHEN 1 THEN 'outgoing'
                                WHEN 2 THEN 'activity'
                                WHEN 3 THEN 'template'
                                ELSE 'unknown'
                              END
                            ) STORED,
  content                   TEXT,
  content_type              TEXT,        -- text / input_select / cards / form
  content_attributes        JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_private                BOOLEAN     NOT NULL DEFAULT false,  -- nota interna: nunca usar em dataset de treino
  status                    TEXT,        -- sent/delivered/read/failed
  external_source_ids       JSONB,       -- IDs nativos (WhatsApp wamid, IG/FB message_id)
  echo_id                   TEXT,        -- dedup quando bot+humano respondem concorrentemente
  sent_at                   TIMESTAMPTZ NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ,
  PRIMARY KEY (id, sent_at),
  UNIQUE (environment, chatwoot_message_id, sent_at)
) PARTITION BY RANGE (sent_at);

COMMENT ON COLUMN core.messages.is_private          IS 'true = nota interna entre agentes. CRITICAL: excluir do dataset de treino LLM.';
COMMENT ON COLUMN core.messages.echo_id             IS 'Chatwoot usa p/ dedup quando bot responde e humano digita junto.';
COMMENT ON COLUMN core.messages.message_type_name   IS 'Gerada automaticamente. Evita analista memorizar 0=incoming, 1=outgoing, etc.';
COMMENT ON COLUMN core.messages.external_source_ids IS 'IDs no canal nativo. Necessário se precisar cruzar com logs da Meta/WhatsApp.';

CREATE TABLE IF NOT EXISTS core.messages_2026_04 PARTITION OF core.messages
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS core.messages_2026_05 PARTITION OF core.messages
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS core.messages_2026_06 PARTITION OF core.messages
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX IF NOT EXISTS messages_conv_sent_idx
  ON core.messages (conversation_id, sent_at);

CREATE INDEX IF NOT EXISTS messages_sent_brin
  ON core.messages USING BRIN (sent_at);

CREATE INDEX IF NOT EXISTS messages_public_sender_idx
  ON core.messages (environment, sender_type) WHERE is_private = false;

CREATE INDEX IF NOT EXISTS messages_content_trgm
  ON core.messages USING GIN (content gin_trgm_ops) WHERE content IS NOT NULL;

-- ------------------------------------------------------------
-- message_attachments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.message_attachments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment             env_t       NOT NULL,
  chatwoot_attachment_id  BIGINT      NOT NULL,
  message_id              UUID        NOT NULL,  -- lógica (messages é particionada)
  conversation_id         UUID        NOT NULL,
  file_type               TEXT        NOT NULL,  -- image / audio / video / file / location / contact
  mime_type               TEXT,
  file_size_bytes         BIGINT,
  duration_ms             INTEGER,                -- áudio/vídeo
  width                   INTEGER,
  height                  INTEGER,
  data_url                TEXT,                   -- URL original no Chatwoot (pode expirar)
  thumb_url               TEXT,
  coordinates_lat         NUMERIC(9, 6),
  coordinates_lng         NUMERIC(9, 6),
  transcription_available BOOLEAN     NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, chatwoot_attachment_id)
);

COMMENT ON COLUMN core.message_attachments.data_url                IS 'URL do Chatwoot pode expirar. Enrichment job deve rebaixar e salvar em storage próprio.';
COMMENT ON COLUMN core.message_attachments.transcription_available IS 'Marca true quando transcrição (fase 2) foi gerada e salva em analytics.';

CREATE INDEX IF NOT EXISTS attachments_msg_idx
  ON core.message_attachments (message_id);

CREATE INDEX IF NOT EXISTS attachments_conv_idx
  ON core.message_attachments (conversation_id);

-- ------------------------------------------------------------
-- conversation_tags
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.conversation_tags (
  environment     env_t       NOT NULL,
  conversation_id UUID        NOT NULL,
  label           TEXT        NOT NULL,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by_type   TEXT,       -- user / system / automation
  PRIMARY KEY (environment, conversation_id, label)
);

COMMENT ON TABLE core.conversation_tags IS 'Labels aplicadas à conversa (ex: "identificacao", "oferta_enviada", "pedido_cancelado"). Viram sinal de funil.';

-- ------------------------------------------------------------
-- conversation_status_events — histórico de transições
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.conversation_status_events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment               env_t       NOT NULL,
  conversation_id           UUID        NOT NULL,
  chatwoot_conversation_id  BIGINT      NOT NULL,
  event_type                TEXT        NOT NULL
                            CHECK (event_type IN ('status_changed', 'label_added', 'label_removed',
                                                  'assigned', 'unassigned', 'team_changed', 'priority_changed')),
  from_value                TEXT,
  to_value                  TEXT,
  changed_by_id             BIGINT,                 -- agent id
  changed_by_type           TEXT,                    -- user / automation / api
  occurred_at               TIMESTAMPTZ NOT NULL,
  raw_event_id              BIGINT,                  -- liga ao raw_events para auditoria
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.conversation_status_events IS 'Histórico de transições de status/label/assignment. Essencial p/ funnel analysis.';

CREATE INDEX IF NOT EXISTS status_events_conv_time_idx
  ON core.conversation_status_events (conversation_id, occurred_at);

CREATE INDEX IF NOT EXISTS status_events_type_idx
  ON core.conversation_status_events (event_type);

-- ------------------------------------------------------------
-- conversation_assignments — quem pegou, quando, por quanto tempo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.conversation_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment      env_t       NOT NULL,
  conversation_id  UUID        NOT NULL,
  agent_id         BIGINT      NOT NULL,
  team_id          BIGINT,
  assigned_at      TIMESTAMPTZ NOT NULL,
  unassigned_at    TIMESTAMPTZ,   -- NULL enquanto está atribuído
  duration_seconds INTEGER GENERATED ALWAYS AS (
                     EXTRACT(EPOCH FROM (unassigned_at - assigned_at))::INTEGER
                   ) STORED,
  handoff_number   SMALLINT    NOT NULL DEFAULT 1  -- 1ª, 2ª, 3ª pessoa a pegar a conversa
);

COMMENT ON TABLE core.conversation_assignments IS 'Rastreia handoffs bot→humano→humano. duration_seconds é gerada automaticamente.';

CREATE INDEX IF NOT EXISTS assignments_conv_idx
  ON core.conversation_assignments (conversation_id, assigned_at);

-- ------------------------------------------------------------
-- message_reactions (emojis)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.message_reactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment   env_t       NOT NULL,
  message_id    UUID        NOT NULL,
  reactor_type  TEXT        NOT NULL CHECK (reactor_type IN ('contact', 'agent')),
  reactor_id    BIGINT,
  emoji         TEXT        NOT NULL,
  reacted_at    TIMESTAMPTZ NOT NULL,
  removed_at    TIMESTAMPTZ,
  UNIQUE (environment, message_id, reactor_type, reactor_id, emoji)
);
