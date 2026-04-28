/**
 * Canonical TypeScript types for Fase 3 additions to `analytics.*`.
 *
 * Source: 0018_analytics_evidence.sql
 * Pre-existing tables (conversation_facts, conversation_classifications,
 * conversation_signals, linguistic_hints, customer_journey) are NOT redefined
 * here — they belong to the Phase 2 enrichment layer.
 *
 * This file adds:
 * - analytics.fact_evidence (new table)
 * - analytics.current_facts (view, includes evidence join)
 * - analytics.current_classifications (view)
 */

import type { Environment } from './chatwoot.js';

// ------------------------------------------------------------------
// analytics.fact_evidence
// ------------------------------------------------------------------

export type EvidenceType = 'literal' | 'inferred' | 'confirmed_by_question';

export interface FactEvidence {
  id: string;
  environment: Environment;
  fact_id: string;
  /** Logical FK → core.messages(id). Partitioned table — no REFERENCES. */
  from_message_id: string;
  evidence_text: string;
  evidence_type: EvidenceType;
  extractor_version: string;
  created_at: Date;
}

// ------------------------------------------------------------------
// View: analytics.current_facts (conversation_facts + latest evidence)
// ------------------------------------------------------------------

export type TruthType = 'observed' | 'inferred' | 'predicted' | 'corrected';

export interface CurrentFact {
  id: string;
  environment: Environment;
  conversation_id: string;
  fact_key: string;
  fact_value: Record<string, unknown>;
  observed_at: Date | null;
  message_id: string | null;
  truth_type: TruthType;
  source: string;
  confidence_level: string; // NUMERIC
  extractor_version: string;
  created_at: Date;
  latest_evidence_text: string | null;
  latest_evidence_message_id: string | null;
  latest_evidence_type: EvidenceType | null;
}

// ------------------------------------------------------------------
// View: analytics.current_classifications
// ------------------------------------------------------------------

export interface CurrentClassification {
  id: string;
  environment: Environment;
  conversation_id: string;
  dimension: string;
  value: string;
  truth_type: TruthType;
  source: string;
  confidence_level: string; // NUMERIC
  extractor_version: string;
  notes: string | null;
  created_at: Date;
}
