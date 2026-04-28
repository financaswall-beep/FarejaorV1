/**
 * Repository para ops.enrichment_jobs — enfileiramento de jobs da Organizadora.
 * Usa a função SQL ops.enqueue_enrichment_job() (criada em 0019) que já faz
 * o upsert com debounce: se já existe job pending para a conversa, apenas
 * atualiza o last_message_id e estende o not_before.
 */

import type { PoolClient } from 'pg';
import { env } from '../shared/config/env.js';

export async function enqueueOrganizadoraJob(
  client: PoolClient,
  environment: string,
  conversationId: string,
  lastMessageId: string,
): Promise<string> {
  const result = await client.query<{ enqueue_enrichment_job: string }>(
    `SELECT ops.enqueue_enrichment_job($1, $2, 'organize_conversation', $3, $4) AS enqueue_enrichment_job`,
    [environment, conversationId, lastMessageId, env.ORGANIZADORA_DEBOUNCE_SECONDS],
  );
  return result.rows[0]!.enqueue_enrichment_job;
}
