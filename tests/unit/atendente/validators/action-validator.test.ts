import { describe, expect, it } from 'vitest';
import { validateAction } from '../../../../src/atendente/validators/action-validator.js';
import type { ConversationState } from '../../../../src/shared/zod/agent-state.js';

const conversationId = '00000000-0000-4000-8000-000000000001';
const itemId = '00000000-0000-4000-8000-000000000002';
const productId = '00000000-0000-4000-8000-000000000003';
const otherProductId = '00000000-0000-4000-8000-000000000004';
const baseTime = '2026-04-29T12:00:00.000Z';

describe('ActionValidator com contexto de tools', () => {
  it('bloqueia record_offer com produto fora de tool result', () => {
    const result = validateAction(
      state(),
      {
        type: 'record_offer',
        action_id: '00000000-0000-4000-8000-000000000101',
        turn_index: 1,
        emitted_at: baseTime,
        emitted_by: 'system',
        offer_id: '00000000-0000-4000-8000-000000000201',
        item_id: itemId,
        products: [{ product_id: otherProductId }],
        expires_at: '2026-04-29T13:00:00.000Z',
      },
      {
        recent_tool_results: [
          {
            tool: 'buscarProduto',
            ok: true,
            output: [{ product_id: productId }],
          },
        ],
      },
    );

    expect(result).toMatchObject({
      valid: false,
      reason: 'offer_product_not_supported_by_tool_result',
    });
  });

  it('bloqueia add_to_cart fora da oferta atual', () => {
    const result = validateAction(stateWithOffer(), {
      type: 'add_to_cart',
      product_id: otherProductId,
      quantity: 1,
    });

    expect(result).toMatchObject({
      valid: false,
      reason: 'cart_product_not_in_current_offer',
    });
  });

  it('permite add_to_cart quando produto esta na oferta e tool result', () => {
    const result = validateAction(
      stateWithOffer(),
      {
        type: 'add_to_cart',
        product_id: productId,
        quantity: 1,
      },
      {
        recent_tool_results: [
          {
            tool: 'buscarProduto',
            ok: true,
            output: [{ product_id: productId }],
          },
        ],
      },
    );

    expect(result).toEqual({ valid: true });
  });
});

function state(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    schema_version: 'atendente_v1.0',
    environment: 'test',
    conversation_id: conversationId,
    contact_id: null,
    status: 'active',
    current_skill: null,
    last_customer_message_id: null,
    last_agent_turn_id: null,
    last_processed_message_id: null,
    version: 0,
    turn_index: 0,
    items: [
      {
        id: itemId,
        conversation_id: conversationId,
        status: 'ofertado',
        is_active: true,
        created_at: baseTime,
        updated_at: baseTime,
        slots: {},
      },
    ],
    global_slots: {},
    cart: [],
    pending_confirmation: null,
    last_offer: null,
    derived_signals: {
      missing_for_close: [],
      stale_slots: [],
      recent_objections: [],
      has_pending_human_request: false,
      offer_expired: false,
    },
    updated_at: baseTime,
    created_at: baseTime,
    ...overrides,
  };
}

function stateWithOffer(): ConversationState {
  return state({
    last_offer: {
      offer_id: '00000000-0000-4000-8000-000000000201',
      item_id: itemId,
      products: [{ product_id: productId }],
      expires_at: '2026-04-29T13:00:00.000Z',
      invalidated: false,
      invalidation_reason: null,
    },
  });
}
