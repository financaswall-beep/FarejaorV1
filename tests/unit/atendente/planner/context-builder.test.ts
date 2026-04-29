import { describe, expect, it, vi } from 'vitest';
import type { ConversationState } from '../../../../src/shared/zod/agent-state.js';

const conversationId = '00000000-0000-4000-8000-000000000001';
const baseTime = '2026-04-29T12:00:00.000Z';

vi.mock('../../../../src/atendente/state/agent-state.repository.js', () => ({
  loadCurrent: vi.fn(async () => state()),
}));

describe('buildPlannerContext', () => {
  it('nao transforma planner_decided antigo em recent_tool_results falso', async () => {
    const { buildPlannerContext } = await import('../../../../src/atendente/planner/context-builder.js');
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          id: '00000000-0000-4000-8000-000000000010',
          sender_type: 'contact',
          message_type: 'incoming',
          content: 'tem pneu pra Bros?',
          sent_at: new Date(baseTime),
        },
      ],
    });

    const context = await buildPlannerContext({ query } as never, 'test', conversationId);

    expect(context.recent_messages).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000010',
        role: 'customer',
        text: 'tem pneu pra Bros?',
        sent_at: baseTime,
      },
    ]);
    expect(context.recent_tool_results).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain('FROM core.messages');
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
    items: [],
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
