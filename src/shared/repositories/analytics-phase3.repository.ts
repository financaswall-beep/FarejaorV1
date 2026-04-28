/**
 * Repository para analytics.* — Fase 3.
 * Cobre: conversation_facts (insert + supersede) e fact_evidence (insert).
 *
 * Invariante sagrada: NUNCA UPDATE de valor. Mudança = nova linha + superseded_by.
 */

import type { PoolClient } from 'pg';
import type { Environment } from '../types/chatwoot.js';
import type { EvidenceType, TruthType } from '../types/analytics-phase3.js';

// ------------------------------------------------------------------
// Tipos de entrada
// ------------------------------------------------------------------

export interface FactInsert {
  environment: Environment;
  conversation_id: string;
  fact_key: string;
  /** Valor primitivo ou objeto. Vai para JSONB. */
  fact_value: unknown;
  observed_at: Date | null;
  /** Logical FK → core.messages(id). Partitioned. */
  message_id: string | null;
  truth_type: TruthType;
  source: string;
  confidence_level: number;
  extractor_version: string;
}

export interface EvidenceInsert {
  environment: Environment;
  fact_id: string;
  /** Logical FK → core.messages(id). Partitioned. */
  from_message_id: string;
  evidence_text: string;
  evidence_type: EvidenceType;
  extractor_version: string;
}

// ------------------------------------------------------------------
// Escrita de fact + evidence na mesma transação
// ------------------------------------------------------------------

/**
 * Insere um novo fact e, se já existe fact ativo para o mesmo
 * conversation_id + fact_key, supersede o anterior.
 *
 * Deve ser chamado dentro de uma transação aberta pelo caller.
 * Retorna o id do fact novo.
 */
export async function writeFactWithEvidence(
  client: PoolClient,
  fact: FactInsert,
  evidence: Omit<EvidenceInsert, 'fact_id' | 'environment'>,
): Promise<string> {
  // 1. Insere o novo fact
  const factResult = await client.query<{ id: string }>(
    `INSERT INTO analytics.conversation_facts
       (environment, conversation_id, fact_key, fact_value,
        observed_at, message_id, truth_type, source,
        confidence_level, extractor_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      fact.environment,
      fact.conversation_id,
      fact.fact_key,
      JSON.stringify(fact.fact_value),
      fact.observed_at,
      fact.message_id,
      fact.truth_type,
      fact.source,
      fact.confidence_level,
      fact.extractor_version,
    ],
  );

  const newFactId = factResult.rows[0]!.id;

  // 2. Supersede o fact anterior ativo para o mesmo conversation_id + fact_key
  //    (qualquer fact que ainda não tenha superseded_by)
  await client.query(
    `UPDATE analytics.conversation_facts
     SET superseded_by = $1
     WHERE environment      = $2
       AND conversation_id  = $3
       AND fact_key         = $4
       AND id               != $1
       AND superseded_by    IS NULL`,
    [newFactId, fact.environment, fact.conversation_id, fact.fact_key],
  );

  // 3. Insere evidence ligada ao novo fact
  await client.query(
    `INSERT INTO analytics.fact_evidence
       (environment, fact_id, from_message_id, evidence_text, evidence_type, extractor_version)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (fact_id, from_message_id, evidence_type) DO NOTHING`,
    [
      fact.environment,
      newFactId,
      evidence.from_message_id,
      evidence.evidence_text,
      evidence.evidence_type,
      evidence.extractor_version,
    ],
  );

  return newFactId;
}

// ------------------------------------------------------------------
// Leitura: facts atuais de uma conversa (para o Context Builder)
// ------------------------------------------------------------------

export interface CurrentFactRow {
  id: string;
  fact_key: string;
  fact_value: unknown;
  truth_type: string;
  confidence_level: string;
  source: string;
  latest_evidence_text: string | null;
}

export async function listCurrentFacts(
  client: PoolClient,
  environment: Environment,
  conversationId: string,
): Promise<CurrentFactRow[]> {
  const result = await client.query<CurrentFactRow>(
    `SELECT id, fact_key, fact_value, truth_type, confidence_level, source, latest_evidence_text
     FROM analytics.current_facts
     WHERE environment     = $1
       AND conversation_id = $2
     ORDER BY fact_key`,
    [environment, conversationId],
  );
  return result.rows;
}
