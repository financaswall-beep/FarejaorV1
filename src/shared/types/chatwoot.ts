/**
 * Chatwoot webhook contracts
 *
 * Zod schemas + inferred TypeScript types for the Chatwoot webhook payloads
 * that the Farejador consumes in Phase 1.
 *
 * Rules:
 * - These schemas are the single source of truth for Chatwoot shapes in this repo.
 * - Do NOT change these schemas without an explicit authorization (see CONTRACTS.md).
 * - Schemas use `.passthrough()` because Chatwoot sends more fields than we use.
 *   We lock down the fields we depend on; the rest flows through untouched and is
 *   persisted in `raw.raw_events.payload` for audit and replay.
 * - The envelope is intentionally permissive: event-specific validation happens
 *   inside `src/normalization/*.mapper.ts`, not at the webhook boundary.
 */

import { z } from 'zod';

// ------------------------------------------------------------------
// Environment (logical dataset discriminator)
// ------------------------------------------------------------------

export const environmentSchema = z.enum(['prod', 'test']);
export type Environment = z.infer<typeof environmentSchema>;

// ------------------------------------------------------------------
// Event types covered in the MVP
// ------------------------------------------------------------------

export const chatwootEventTypeSchema = z.enum([
  'conversation_created',
  'conversation_updated',
  'conversation_status_changed',
  'message_created',
  'message_updated',
  'contact_created',
  'contact_updated',
]);
export type ChatwootEventType = z.infer<typeof chatwootEventTypeSchema>;

// ------------------------------------------------------------------
// Primitive entity schemas
// ------------------------------------------------------------------

/** Chatwoot sends timestamps either as ISO strings or Unix seconds. */
const timestampSchema = z.union([z.string(), z.number()]);

export const chatwootContactSchema = z
  .object({
    id: z.number().int(),
    account_id: z.number().int().optional(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone_number: z.string().nullable().optional(),
    identifier: z.string().nullable().optional(),
    additional_attributes: z.record(z.unknown()).optional(),
    custom_attributes: z.record(z.unknown()).optional(),
  })
  .passthrough();
export type ChatwootContact = z.infer<typeof chatwootContactSchema>;

export const chatwootAttachmentSchema = z
  .object({
    id: z.number().int(),
    message_id: z.number().int().optional(),
    account_id: z.number().int().optional(),
    file_type: z.string(),
    extension: z.string().nullable().optional(),
    mime_type: z.string().nullable().optional(),
    data_url: z.string().nullable().optional(),
    thumb_url: z.string().nullable().optional(),
    file_size: z.number().nullable().optional(),
    fallback_title: z.string().nullable().optional(),
    coordinates_lat: z.number().nullable().optional(),
    coordinates_long: z.number().nullable().optional(),
  })
  .passthrough();
export type ChatwootAttachment = z.infer<typeof chatwootAttachmentSchema>;

/**
 * Chatwoot `message_type` is either numeric (0..3) or a string name. The normalizer
 * maps both to the numeric form stored in `core.messages.message_type`.
 * 0 = incoming, 1 = outgoing, 2 = activity, 3 = template.
 */
export const chatwootMessageTypeSchema = z.union([
  z.number().int().min(0).max(3),
  z.enum(['incoming', 'outgoing', 'activity', 'template']),
]);
export type ChatwootMessageType = z.infer<typeof chatwootMessageTypeSchema>;

export const chatwootMessageSchema = z
  .object({
    id: z.number().int(),
    conversation_id: z.number().int().optional(),
    account_id: z.number().int().optional(),
    inbox_id: z.number().int().optional(),
    content: z.string().nullable().optional(),
    content_type: z.string().nullable().optional(),
    message_type: chatwootMessageTypeSchema,
    private: z.boolean().optional(),
    status: z.string().nullable().optional(),
    source_id: z.string().nullable().optional(),
    sender_type: z.string().nullable().optional(),
    sender_id: z.number().int().nullable().optional(),
    sender: z.record(z.unknown()).optional(),
    created_at: timestampSchema.optional(),
    updated_at: timestampSchema.optional(),
    external_source_ids: z.record(z.unknown()).optional(),
    echo_id: z.string().nullable().optional(),
    attachments: z.array(chatwootAttachmentSchema).optional(),
    content_attributes: z.record(z.unknown()).optional(),
  })
  .passthrough();
export type ChatwootMessage = z.infer<typeof chatwootMessageSchema>;

export const chatwootConversationStatusSchema = z.enum([
  'open',
  'resolved',
  'pending',
  'snoozed',
]);
export type ChatwootConversationStatus = z.infer<typeof chatwootConversationStatusSchema>;

export const chatwootConversationSchema = z
  .object({
    id: z.number().int(),
    account_id: z.number().int().optional(),
    inbox_id: z.number().int().optional(),
    status: chatwootConversationStatusSchema.optional(),
    assignee_id: z.number().int().nullable().optional(),
    team_id: z.number().int().nullable().optional(),
    contact_id: z.number().int().nullable().optional(),
    contact_inbox: z.record(z.unknown()).optional(),
    meta: z.record(z.unknown()).optional(),
    additional_attributes: z.record(z.unknown()).optional(),
    custom_attributes: z.record(z.unknown()).optional(),
    priority: z.string().nullable().optional(),
    created_at: timestampSchema.optional(),
    updated_at: timestampSchema.optional(),
    timestamp: timestampSchema.optional(),
    messages: z.array(chatwootMessageSchema).optional(),
    labels: z.array(z.string()).optional(),
  })
  .passthrough();
export type ChatwootConversation = z.infer<typeof chatwootConversationSchema>;

// ------------------------------------------------------------------
// Webhook envelope
// ------------------------------------------------------------------

/**
 * Minimal envelope accepted by the webhook boundary. Chatwoot places the entity
 * payload at the top level (the shape depends on `event`). Event-specific parsing
 * happens later in `src/normalization/*.mapper.ts` — not at the HTTP boundary.
 *
 * The boundary only verifies that:
 *   1. `event` is present and is one of the supported event types
 *   2. the body is valid JSON
 *
 * Everything else flows through via `.passthrough()` and is stored verbatim in
 * `raw.raw_events.payload`.
 */
export const chatwootWebhookEnvelopeSchema = z
  .object({
    event: chatwootEventTypeSchema,
    account: z
      .object({ id: z.number().int() })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type ChatwootWebhookEnvelope = z.infer<typeof chatwootWebhookEnvelopeSchema>;

// ------------------------------------------------------------------
// Webhook header contract
// ------------------------------------------------------------------

/**
 * Headers we depend on. Fastify lowercases header names by default.
 */
export const chatwootWebhookHeadersSchema = z.object({
  'x-chatwoot-signature': z.string().min(1),
  'x-chatwoot-delivery': z.string().min(1),
  'x-chatwoot-timestamp': z.string().min(1).optional(),
});
export type ChatwootWebhookHeaders = z.infer<typeof chatwootWebhookHeadersSchema>;
