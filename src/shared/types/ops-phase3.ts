/**
 * Canonical TypeScript types for Fase 3 additions to `ops.*`.
 *
 * Source: 0019_ops_phase3_additions.sql
 * Pre-existing tables (enrichment_jobs, stock_snapshots, bot_events, erasure_log)
 * are NOT redefined here — they belong to Phase 1/2 ops layer.
 *
 * This file adds:
 * - ops.atendente_jobs
 * - ops.unhandled_messages
 * - ops.agent_incidents
 * Plus the extended fields added to ops.enrichment_jobs in Fase 3.
 */

import type { Environment } from './chatwoot.js';

// ------------------------------------------------------------------
// ops.atendente_jobs
// ------------------------------------------------------------------

export type AtendenteJobStatus = 'pending' | 'processing' | 'processed' | 'failed';

export interface AtendenteJob {
  id: string;
  environment: Environment;
  conversation_id: string;
  /** Logical FK → core.messages(id). UNIQUE: one job per customer message. */
  trigger_message_id: string;
  status: AtendenteJobStatus;
  not_before: Date;
  attempts: number;
  locked_at: Date | null;
  locked_by: string | null;
  error_message: string | null;
  processed_at: Date | null;
  created_at: Date;
}

// ------------------------------------------------------------------
// ops.unhandled_messages
// ------------------------------------------------------------------

export type FallbackReason =
  | 'router_no_skill'
  | 'policy_missing'
  | 'data_missing'
  | 'evidence_low'
  | 'other';

export interface UnhandledMessage {
  id: string;
  environment: Environment;
  conversation_id: string;
  /** Logical FK → core.messages(id). */
  message_id: string;
  message_text: string | null;
  fallback_reason: FallbackReason;
  skill_used: string;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  promoted_to_skill: string | null;
  notes: string | null;
  created_at: Date;
}

// ------------------------------------------------------------------
// ops.agent_incidents
// ------------------------------------------------------------------

export type IncidentType =
  | 'validator_blocked'
  | 'llm_timeout'
  | 'llm_api_error'
  | 'pending_confirmation_expired'
  | 'transaction_rollback'
  | 'router_no_skill_matched'
  | 'evidence_not_literal'
  | 'schema_violation'
  | 'context_build_failed'
  | 'action_handler_failed';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AgentIncident {
  id: string;
  environment: Environment;
  conversation_id: string | null;
  agent_turn_id: string | null;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  details: Record<string, unknown>;
  resolved_at: Date | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: Date;
}

// ------------------------------------------------------------------
// ops.enrichment_jobs — Fase 3 extended fields only
// (base fields from Phase 1/2 are intentionally omitted here)
// ------------------------------------------------------------------

export type EnrichmentJobType =
  | 'audio_transcription'
  | 'image_ocr'
  | 'llm_classification'
  | 'geocoding'
  | 'erp_price_lookup'
  | 'fact_extraction'
  | 'organize_conversation'
  | 'reenrich_conversation'
  | 'backfill';

export type EnrichmentJobStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'failed'
  | 'skipped'
  | 'pending'
  | 'processing'
  | 'processed';

/** Only the Fase 3 columns added to ops.enrichment_jobs. */
export interface EnrichmentJobPhase3Fields {
  conversation_id: string | null;
  /** Logical FK → core.messages(id). */
  last_message_id: string | null;
  /** Logical FK → core.messages(id). */
  last_processed_message_id: string | null;
  not_before: Date;
  locked_at: Date | null;
  locked_by: string | null;
}
