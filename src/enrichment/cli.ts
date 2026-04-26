import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../persistence/db.js';
import { enrichConversation } from './signals.service.js';
import { logger } from '../shared/logger.js';
import { env } from '../shared/config/env.js';

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

export async function runCli(argv: string[]): Promise<void> {
  const options = parseArgs(argv);

  if (options.segment) {
    logger.info({ segment: options.segment }, 'segment argument accepted and ignored in F2A-01');
  }

  const client = await pool.connect();
  try {
    const enriched = await enrichConversation(client, options.conversationId, env.FAREJADOR_ENV);
    if (!enriched) {
      throw new Error(`Conversation not found in environment ${env.FAREJADOR_ENV}: ${options.conversationId}`);
    }

    logger.info({ conversation_id: options.conversationId }, 'conversation signals computed');
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
