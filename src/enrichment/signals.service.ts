import type { PoolClient } from 'pg';
import { computeAndUpsertSignals } from './signals.repository.js';

export async function enrichConversation(
  client: PoolClient,
  conversationId: string,
  environment: string,
  timezone: string,
): Promise<boolean> {
  return computeAndUpsertSignals(client, conversationId, environment, timezone);
}
