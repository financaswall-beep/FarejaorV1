/**
 * Zod schemas for the `actions` array returned by LLM Atendente.
 *
 * The Atendente LLM returns a JSON object: { say: string, actions: AgentAction[] }.
 * Each action is a discriminated union on `type`.
 * Action handlers (src/atendente/action-handlers/) read these validated objects
 * and write to `agent.*` tables. The LLM NEVER touches the DB directly.
 *
 * Design rules:
 * - Every action that writes state must pass through these schemas first.
 * - Schema validation failure → incident logged, turn marked `blocked`, escalation.
 * - Keep payloads minimal: only what the handler needs; no derived values.
 *
 * Source of truth for the full list of actions: docs/phase3-agent-architecture/09-skills-router-e-validadores.md
 */

import { z } from 'zod';

// ------------------------------------------------------------------
// Cart actions
// ------------------------------------------------------------------

/** Add an item to agent.cart_current_items. */
export const addToCartSchema = z.object({
  type: z.literal('add_to_cart'),
  product_id: z.string().uuid({ message: 'product_id must be a valid UUID' }),
  quantity: z.number().int().min(1).max(20),
  /** Optional: LLM may include price from context. Handler validates against DB. */
  unit_price: z.number().min(0).optional(),
});

/** Remove an item from agent.cart_current_items. */
export const removeFromCartSchema = z.object({
  type: z.literal('remove_from_cart'),
  cart_item_id: z.string().uuid(),
});

/** Change quantity of an existing cart item. */
export const updateCartItemSchema = z.object({
  type: z.literal('update_cart_item'),
  cart_item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

/** Clear all items — resets cart_current to empty. */
export const clearCartSchema = z.object({
  type: z.literal('clear_cart'),
});

// ------------------------------------------------------------------
// Order draft (slot filling) actions
// ------------------------------------------------------------------

/** Update checkout slots in agent.order_drafts. Partial — only supplied fields are written. */
export const updateDraftSchema = z.object({
  type: z.literal('update_draft'),
  customer_name: z.string().min(1).max(120).optional(),
  delivery_address: z.string().min(1).max(500).optional(),
  fulfillment_mode: z.enum(['delivery', 'pickup']).optional(),
  payment_method: z
    .enum(['pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'boleto'])
    .optional(),
});

// ------------------------------------------------------------------
// Confirmation actions
// ------------------------------------------------------------------

/**
 * Ask the customer to confirm something. Creates agent.pending_confirmations.
 * A confirmation is pending until the customer answers or it expires (24 h).
 */
export const requestConfirmationSchema = z.object({
  type: z.literal('request_confirmation'),
  confirmation_type: z.enum([
    'fact_confirmation',
    'cart_confirmation',
    'order_confirmation',
    'fitment_confirmation',
  ]),
  /** Facts the handler will create/update upon a positive reply. */
  expected_facts: z.record(z.unknown()),
  /** ISO string or seconds-from-now. Defaults to 24 h if omitted. */
  expires_in_seconds: z.number().int().min(60).max(86400).optional(),
});

// ------------------------------------------------------------------
// Escalation action
// ------------------------------------------------------------------

/**
 * Escalate conversation to human. Creates agent.escalations.
 * The summary_text is shown as a Chatwoot internal note.
 */
export const escalateSchema = z.object({
  type: z.literal('escalate'),
  reason: z.enum([
    'ready_to_close',
    'customer_requested',
    'validator_blocked',
    'confidence_low',
    'pending_expired',
    'other',
  ]),
  /**
   * Human-readable summary in Portuguese, written by the LLM.
   * Shown to the store attendant as a Chatwoot internal note.
   */
  summary_text: z.string().min(1).max(2000),
});

// ------------------------------------------------------------------
// Session control actions
// ------------------------------------------------------------------

/** Switch the active skill. Updates agent.session_current.current_skill. */
export const selectSkillSchema = z.object({
  type: z.literal('select_skill'),
  skill_name: z.string().min(1).max(80),
});

// ------------------------------------------------------------------
// Discriminated union — the canonical AgentAction type
// ------------------------------------------------------------------

export const agentActionSchema = z.discriminatedUnion('type', [
  addToCartSchema,
  removeFromCartSchema,
  updateCartItemSchema,
  clearCartSchema,
  updateDraftSchema,
  requestConfirmationSchema,
  escalateSchema,
  selectSkillSchema,
]);

export type AgentAction = z.infer<typeof agentActionSchema>;
export type AddToCartAction = z.infer<typeof addToCartSchema>;
export type RemoveFromCartAction = z.infer<typeof removeFromCartSchema>;
export type UpdateCartItemAction = z.infer<typeof updateCartItemSchema>;
export type ClearCartAction = z.infer<typeof clearCartSchema>;
export type UpdateDraftAction = z.infer<typeof updateDraftSchema>;
export type RequestConfirmationAction = z.infer<typeof requestConfirmationSchema>;
export type EscalateAction = z.infer<typeof escalateSchema>;
export type SelectSkillAction = z.infer<typeof selectSkillSchema>;

// ------------------------------------------------------------------
// Full LLM Atendente response envelope
// ------------------------------------------------------------------

/**
 * The complete JSON object that the LLM Atendente must return.
 * The Say Validator checks `say` before it goes to Chatwoot.
 * The Action Validator parses `actions` through agentActionSchema for each element.
 */
export const llmAtendenteResponseSchema = z.object({
  /**
   * The text to send to the customer via Chatwoot.
   * Say Validator must block: internal_notes leaks, PII exposure, empty string.
   */
  say: z.string().min(1).max(4000),
  /** May be empty array when the turn only sends a message with no state change. */
  actions: z.array(agentActionSchema).max(10),
});

export type LLMAtendenteResponse = z.infer<typeof llmAtendenteResponseSchema>;
