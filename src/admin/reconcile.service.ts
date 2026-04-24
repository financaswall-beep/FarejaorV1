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
  chatwoot_conversation_id: number;
  reason: string;
}

export interface ReconcileResult {
  inserted: number;
  skipped_duplicate: number;
  errors: ReconcileError[];
  pages_fetched: number;
}

export interface ReconcileChatwootClient {
  listConversations(input: { since: Date; until: Date; page: number }): Promise<ChatwootPage>;
  listMessages(input: { conversationId: number; page: number }): Promise<ChatwootPage>;
}

type InsertRawEventFn = typeof claimAndInsertRawEvent;

export interface ReconcileDependencies {
  chatwootClient?: ReconcileChatwootClient;
  pool?: Pool;
  insertRawEvent?: InsertRawEventFn;
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

async function insertSyntheticRawEvent(
  dbPool: Pool,
  insertRawEvent: InsertRawEventFn,
  input: Parameters<InsertRawEventFn>[1],
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

export async function reconcile(
  input: ReconcileInput,
  dependencies: ReconcileDependencies = {},
): Promise<ReconcileResult> {
  const startedAt = Date.now();
  const chatwootClient = dependencies.chatwootClient ?? new ChatwootApiClient();
  const dbPool = dependencies.pool ?? defaultPool;
  const insertRawEvent = dependencies.insertRawEvent ?? claimAndInsertRawEvent;
  const result: ReconcileResult = {
    inserted: 0,
    skipped_duplicate: 0,
    errors: [],
    pages_fetched: 0,
  };

  let conversationPage = 1;
  let hasMoreConversations = true;

  while (hasMoreConversations) {
    const conversationsPage = await chatwootClient.listConversations({
      since: input.since,
      until: input.until,
      page: conversationPage,
    });
    result.pages_fetched++;

    for (const rawConversation of conversationsPage.items) {
      const conversationResult = conversationSchema.safeParse(rawConversation);
      if (!conversationResult.success) {
        result.errors.push({
          chatwoot_conversation_id: 0,
          reason: 'invalid conversation payload',
        });
        continue;
      }

      const conversation = conversationResult.data;
      const conversationUpdatedAt = parseTimestampToDate(conversation.updated_at);
      if (!conversationUpdatedAt) {
        result.errors.push({
          chatwoot_conversation_id: conversation.id,
          reason: 'conversation updated_at missing or invalid',
        });
        continue;
      }

      try {
        const rawEventId = await insertSyntheticRawEvent(dbPool, insertRawEvent, {
          environment: input.environment,
          chatwootDeliveryId: `reconcile:conv:${input.environment}:${conversation.id}:${unixSeconds(conversationUpdatedAt)}`,
          chatwootSignature: 'reconcile:synthetic',
          chatwootTimestamp: conversationUpdatedAt,
          eventType: 'conversation_updated',
          accountId: env.CHATWOOT_ACCOUNT_ID ?? null,
          payload: withEvent(conversation, 'conversation_updated'),
        });

        if (rawEventId === null) {
          result.skipped_duplicate++;
        } else {
          result.inserted++;
        }
      } catch (err) {
        result.errors.push({
          chatwoot_conversation_id: conversation.id,
          reason: errorReason(err),
        });
      }

      let messagePage = 1;
      let hasMoreMessages = true;

      while (hasMoreMessages) {
        const messagesPage = await chatwootClient.listMessages({
          conversationId: conversation.id,
          page: messagePage,
        });

        for (const rawMessage of messagesPage.items) {
          const messageResult = messageSchema.safeParse(rawMessage);
          if (!messageResult.success) {
            result.errors.push({
              chatwoot_conversation_id: conversation.id,
              reason: 'invalid message payload',
            });
            continue;
          }

          const message = messageResult.data;
          const messageCreatedAt = parseTimestampToDate(message.created_at);
          if (!messageCreatedAt) {
            result.errors.push({
              chatwoot_conversation_id: conversation.id,
              reason: `message ${message.id} created_at missing or invalid`,
            });
            continue;
          }

          try {
            const rawEventId = await insertSyntheticRawEvent(dbPool, insertRawEvent, {
              environment: input.environment,
              chatwootDeliveryId: `reconcile:msg:${input.environment}:${message.id}:${unixSeconds(messageCreatedAt)}`,
              chatwootSignature: 'reconcile:synthetic',
              chatwootTimestamp: messageCreatedAt,
              eventType: 'message_created',
              accountId: env.CHATWOOT_ACCOUNT_ID ?? null,
              payload: withEvent(message, 'message_created'),
            });

            if (rawEventId === null) {
              result.skipped_duplicate++;
            } else {
              result.inserted++;
            }
          } catch (err) {
            result.errors.push({
              chatwoot_conversation_id: conversation.id,
              reason: errorReason(err),
            });
          }
        }

        hasMoreMessages = messagesPage.hasMore;
        messagePage++;
      }
    }

    hasMoreConversations = conversationsPage.hasMore;
    conversationPage++;
  }

  logger.info(
    {
      inserted: result.inserted,
      skipped_duplicate: result.skipped_duplicate,
      errors_count: result.errors.length,
      pages_fetched: result.pages_fetched,
      duration_ms: Date.now() - startedAt,
    },
    'admin reconcile completed',
  );

  return result;
}
