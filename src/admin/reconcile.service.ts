import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { ChatwootApiClient, type ChatwootPage } from './chatwoot-api.client.js';
import { pool as defaultPool } from '../persistence/db.js';
import { claimAndInsertRawEvent } from '../persistence/raw-events.repository.js';
import { env } from '../shared/config/env.js';
import { logger } from '../shared/logger.js';

const timestampSchema = z.union([z.string(), z.number()]);
const conversationSchema = z
  .object({
    id: z.number().int(),
    updated_at: timestampSchema,
  })
  .passthrough();
const messageSchema = z
  .object({
    id: z.number().int(),
    conversation_id: z.number().int().optional(),
    created_at: timestampSchema,
  })
  .passthrough();

export interface ReconcileInput {
  since: Date;
  until: Date;
  environment: 'prod' | 'test';
}

export interface ReconcileError {
  chatwoot_conversation_id: number | null;
  reason: string;
}

export interface ReconcileResult {
  inserted: number;
  skipped_duplicate: number;
  errors: ReconcileError[];
  pages_fetched: number;
  aborted: boolean;
  abort_reason: string | null;
}

export interface ReconcileChatwootClient {
  listConversations(input: { since: Date; until: Date; page: number }): Promise<ChatwootPage>;
  listMessages(input: { conversationId: number; page: number }): Promise<ChatwootPage>;
}

type InsertRawEventFn = typeof claimAndInsertRawEvent;
type RawEventInput = Parameters<InsertRawEventFn>[1];
type MappedConversation = z.infer<typeof conversationSchema>;
type MappedMessage = z.infer<typeof messageSchema>;

export interface ReconcileDependencies {
  chatwootClient?: ReconcileChatwootClient;
  pool?: Pool;
  insertRawEvent?: InsertRawEventFn;
}

interface InsertContext {
  dbPool: Pool;
  insertRawEvent: InsertRawEventFn;
  result: ReconcileResult;
}

interface SyntheticEvent {
  conversationId: number | null;
  input: RawEventInput;
}

function createInitialResult(): ReconcileResult {
  return {
    inserted: 0,
    skipped_duplicate: 0,
    errors: [],
    pages_fetched: 0,
    aborted: false,
    abort_reason: null,
  };
}

function parseTimestampToDate(value: unknown): Date | null {
  if (typeof value === 'number') {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function isWithinWindow(date: Date, input: ReconcileInput): boolean {
  return date >= input.since && date <= input.until;
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function errorReason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function withEvent(payload: Record<string, unknown>, event: string): Record<string, unknown> {
  return {
    ...payload,
    event,
  };
}

function pushError(result: ReconcileResult, conversationId: number | null, reason: string): void {
  result.errors.push({
    chatwoot_conversation_id: conversationId,
    reason,
  });
}

function buildConversationEvent(input: ReconcileInput, conversation: MappedConversation): SyntheticEvent | null {
  const updatedAt = parseTimestampToDate(conversation.updated_at);
  if (!updatedAt) {
    return null;
  }

  return {
    conversationId: conversation.id,
    input: {
      environment: input.environment,
      chatwootDeliveryId: `reconcile:conv:${input.environment}:${conversation.id}:${unixSeconds(updatedAt)}`,
      chatwootSignature: 'reconcile:synthetic',
      chatwootTimestamp: updatedAt,
      eventType: 'conversation_updated',
      accountId: env.CHATWOOT_ACCOUNT_ID ?? null,
      payload: withEvent(conversation, 'conversation_updated'),
    },
  };
}

function buildMessageEvent(
  input: ReconcileInput,
  conversationId: number,
  message: MappedMessage,
): SyntheticEvent | null {
  const createdAt = parseTimestampToDate(message.created_at);
  if (!createdAt) {
    return null;
  }

  return {
    conversationId,
    input: {
      environment: input.environment,
      chatwootDeliveryId: `reconcile:msg:${input.environment}:${message.id}:${unixSeconds(createdAt)}`,
      chatwootSignature: 'reconcile:synthetic',
      chatwootTimestamp: createdAt,
      eventType: 'message_created',
      accountId: env.CHATWOOT_ACCOUNT_ID ?? null,
      payload: withEvent(message, 'message_created'),
    },
  };
}

async function insertSyntheticRawEvent(
  dbPool: Pool,
  insertRawEvent: InsertRawEventFn,
  input: RawEventInput,
): Promise<number | null> {
  let client: PoolClient | null = null;

  try {
    client = await dbPool.connect();
    await client.query('BEGIN');
    const rawEventId = await insertRawEvent(client, input);
    await client.query('COMMIT');
    return rawEventId;
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw err;
  } finally {
    client?.release();
  }
}

async function processSyntheticEvent(context: InsertContext, event: SyntheticEvent): Promise<void> {
  try {
    const rawEventId = await insertSyntheticRawEvent(
      context.dbPool,
      context.insertRawEvent,
      event.input,
    );

    if (rawEventId === null) {
      context.result.skipped_duplicate++;
    } else {
      context.result.inserted++;
    }
  } catch (err) {
    pushError(context.result, event.conversationId, errorReason(err));
  }
}

async function processMessagesForConversation(
  input: ReconcileInput,
  chatwootClient: ReconcileChatwootClient,
  context: InsertContext,
  conversationId: number,
): Promise<void> {
  let messagePage = 1;
  let hasMoreMessages = true;

  while (hasMoreMessages) {
    let messagesPage: ChatwootPage;

    try {
      messagesPage = await chatwootClient.listMessages({
        conversationId,
        page: messagePage,
      });
    } catch (err) {
      pushError(context.result, conversationId, `messages pagination failed: ${errorReason(err)}`);
      return;
    }

    for (const rawMessage of messagesPage.items) {
      const messageResult = messageSchema.safeParse(rawMessage);
      if (!messageResult.success) {
        pushError(context.result, conversationId, 'invalid message payload');
        continue;
      }

      const event = buildMessageEvent(input, conversationId, messageResult.data);
      if (!event) {
        pushError(
          context.result,
          conversationId,
          `message ${messageResult.data.id} created_at missing or invalid`,
        );
        continue;
      }

      await processSyntheticEvent(context, event);
    }

    hasMoreMessages = messagesPage.hasMore;
    messagePage++;
  }
}

async function processConversation(
  input: ReconcileInput,
  chatwootClient: ReconcileChatwootClient,
  context: InsertContext,
  rawConversation: Record<string, unknown>,
): Promise<void> {
  const conversationResult = conversationSchema.safeParse(rawConversation);
  if (!conversationResult.success) {
    pushError(context.result, null, 'invalid conversation payload');
    return;
  }

  const conversation = conversationResult.data;
  const updatedAt = parseTimestampToDate(conversation.updated_at);
  if (!updatedAt) {
    pushError(context.result, conversation.id, 'conversation updated_at missing or invalid');
    return;
  }

  if (!isWithinWindow(updatedAt, input)) {
    return;
  }

  const conversationEvent = buildConversationEvent(input, conversation);
  if (!conversationEvent) {
    pushError(context.result, conversation.id, 'conversation updated_at missing or invalid');
    return;
  }

  await processSyntheticEvent(context, conversationEvent);
  await processMessagesForConversation(input, chatwootClient, context, conversation.id);
}

export async function reconcile(
  input: ReconcileInput,
  dependencies: ReconcileDependencies = {},
): Promise<ReconcileResult> {
  const startedAt = Date.now();
  const chatwootClient = dependencies.chatwootClient ?? new ChatwootApiClient();
  const context: InsertContext = {
    dbPool: dependencies.pool ?? defaultPool,
    insertRawEvent: dependencies.insertRawEvent ?? claimAndInsertRawEvent,
    result: createInitialResult(),
  };

  let conversationPage = 1;
  let hasMoreConversations = true;

  while (hasMoreConversations) {
    let conversationsPage: ChatwootPage;

    try {
      conversationsPage = await chatwootClient.listConversations({
        since: input.since,
        until: input.until,
        page: conversationPage,
      });
    } catch (err) {
      context.result.aborted = true;
      context.result.abort_reason = `conversation pagination failed: ${errorReason(err)}`;
      break;
    }

    context.result.pages_fetched++;

    for (const rawConversation of conversationsPage.items) {
      await processConversation(input, chatwootClient, context, rawConversation);
    }

    hasMoreConversations = conversationsPage.hasMore;
    conversationPage++;
  }

  logger.info(
    {
      inserted: context.result.inserted,
      skipped_duplicate: context.result.skipped_duplicate,
      errors_count: context.result.errors.length,
      pages_fetched: context.result.pages_fetched,
      aborted: context.result.aborted,
      duration_ms: Date.now() - startedAt,
    },
    'admin reconcile completed',
  );

  return context.result;
}
