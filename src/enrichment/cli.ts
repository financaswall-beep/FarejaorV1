import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../persistence/db.js';
import { enrichConversation } from './signals.service.js';
import { logger } from '../shared/logger.js';
import { env } from '../shared/config/env.js';
import { loadSegment, applyRules } from './index.js';
import { insertHints, insertFacts } from './index.js';
import { enrichClassifications } from './classification.service.js';
import { upsertClassifications } from './classifications.repository.js';
import type { EngineMessage } from './rules.engine.js';

export interface CliOptions {
  conversationId: string;
  segment?: string;
}

export function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const options: CliOptions = { conversationId: '' };

  for (const arg of args) {
    if (arg.startsWith('--conversation-id=')) {
      options.conversationId = arg.slice('--conversation-id='.length);
    } else if (arg.startsWith('--segment=')) {
      options.segment = arg.slice('--segment='.length);
    }
  }

  if (!options.conversationId) {
    throw new Error('Missing required argument: --conversation-id=<uuid>');
  }

  return options;
}

import type { PoolClient } from 'pg';

async function loadMessages(
  client: PoolClient,
  conversationId: string,
  environment: string,
): Promise<EngineMessage[]> {
  const result = await client.query<{
    id: string;
    content: string | null;
    sender_type: string;
    sent_at: Date;
  }>(
    `SELECT id, content, sender_type, sent_at
     FROM core.messages
     WHERE conversation_id = $1 AND environment = $2 AND is_private = false
     ORDER BY sent_at ASC`,
    [conversationId, environment],
  );

  return result.rows.map((row) => ({
    message_id: row.id,
    content: row.content,
    sender_type: row.sender_type,
    sent_at: row.sent_at,
  }));
}

export async function runCli(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  const segmentName = options.segment ?? 'generic';

  logger.info({ segment: segmentName, conversation_id: options.conversationId }, 'starting enrichment');

  const client = await pool.connect();
  try {
    // Step 1: signals
    const enriched = await enrichConversation(
      client,
      options.conversationId,
      env.FAREJADOR_ENV,
      env.SIGNAL_TIMEZONE,
    );
    if (!enriched) {
      throw new Error(`Conversation not found in environment ${env.FAREJADOR_ENV}: ${options.conversationId}`);
    }
    logger.info({ conversation_id: options.conversationId }, 'conversation signals computed');

    // Step 2: rules engine (hints + facts)
    const segment = await loadSegment(segmentName);
    const messages = await loadMessages(client, options.conversationId, env.FAREJADOR_ENV);
    const engineResult = applyRules(
      messages,
      options.conversationId,
      env.FAREJADOR_ENV,
      segment,
    );
    const hintsInserted = await insertHints(client, engineResult.hints);
    const factsInserted = await insertFacts(client, engineResult.facts);
    logger.info(
      { conversation_id: options.conversationId, hintsInserted, factsInserted },
      'rules engine applied',
    );

    // Step 3: classifications
    const classifications = await enrichClassifications(
      client,
      options.conversationId,
      env.FAREJADOR_ENV,
    );
    const classificationsInserted = await upsertClassifications(
      client,
      options.conversationId,
      env.FAREJADOR_ENV,
      classifications,
    );
    logger.info(
      { conversation_id: options.conversationId, classificationsInserted },
      'classifications computed',
    );
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  try {
    await runCli(process.argv);
  } catch (err) {
    logger.error({ err }, 'cli failed');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function isDirectRun(): boolean {
  return process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
}

if (isDirectRun()) {
  void main();
}
