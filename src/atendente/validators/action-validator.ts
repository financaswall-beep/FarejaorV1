import type { AgentAction } from '../../shared/zod/agent-actions.js';
import {
  globalSlotKeySchema,
  isCriticalSlot,
  itemSlotKeySchema,
  type ConversationState,
  type SessionSlotKey,
} from '../../shared/zod/agent-state.js';

export type ActionValidationResult =
  | { valid: true }
  | { valid: false; reason: string; severity: 'block' | 'warn' };

function block(reason: string): ActionValidationResult {
  return { valid: false, reason, severity: 'block' };
}

function itemExists(state: ConversationState, itemId: string): boolean {
  return state.items.some((item) => item.id === itemId);
}

function validateSlotScope(action: Extract<AgentAction, { type: 'update_slot' | 'mark_slot_stale' }>) {
  if (action.scope === 'global') {
    if (action.item_id !== null) {
      return block('global_slot_must_not_have_item_id');
    }
    if (!globalSlotKeySchema.safeParse(action.slot_key).success) {
      return block('slot_not_allowed_in_global_scope');
    }
    return { valid: true } as const;
  }

  if (!action.item_id) {
    return block('item_slot_requires_item_id');
  }
  if (!itemSlotKeySchema.safeParse(action.slot_key).success) {
    return block('slot_not_allowed_in_item_scope');
  }
  return { valid: true } as const;
}

function hasConfirmedCriticalSlots(state: ConversationState): boolean {
  for (const item of state.items.filter((candidate) => candidate.status === 'ofertado')) {
    for (const key of ['medida_pneu', 'quantidade'] satisfies SessionSlotKey[]) {
      const slot = item.slots?.[key];
      if (!slot || slot.source !== 'confirmed' || slot.stale !== 'fresh') {
        return false;
      }
    }
  }
  return true;
}

export function validateAction(state: ConversationState, action: AgentAction): ActionValidationResult {
  switch (action.type) {
    case 'update_slot': {
      const scopeValidation = validateSlotScope(action);
      if (!scopeValidation.valid) {
        return scopeValidation;
      }
      if (action.source === 'confirmed' && !action.set_by_message_id) {
        return block('confirmed_slot_requires_message_id');
      }
      if (isCriticalSlot(action.slot_key) && action.source.startsWith('inferred')) {
        return { valid: true };
      }
      return { valid: true };
    }
    case 'mark_slot_stale':
      return validateSlotScope(action);
    case 'create_item':
      if (itemExists(state, action.item_id)) {
        return block('item_already_exists');
      }
      if (state.items.filter((item) => item.status !== 'descartado').length >= 5) {
        return block('too_many_open_items');
      }
      return { valid: true };
    case 'set_active_item': {
      const item = state.items.find((candidate) => candidate.id === action.item_id);
      if (!item) {
        return block('item_not_found');
      }
      if (item.status === 'descartado') {
        return block('cannot_activate_discarded_item');
      }
      return { valid: true };
    }
    case 'update_item_status':
      return itemExists(state, action.item_id) ? { valid: true } : block('item_not_found');
    case 'record_offer': {
      const item = state.items.find((candidate) => candidate.id === action.item_id);
      if (!item) {
        return block('item_not_found');
      }
      if (!['aberto', 'ofertado'].includes(item.status)) {
        return block('offer_requires_open_or_offered_item');
      }
      return { valid: true };
    }
    case 'invalidate_offer':
      return state.last_offer ? { valid: true } : block('no_offer_to_invalidate');
    case 'add_objection':
      return { valid: true };
    case 'unsupported_observation':
      return action.requires_human_review ? { valid: true } : block('unsupported_observation_requires_review');
    case 'request_confirmation':
      if (
        action.confirmation_type === 'order_confirmation' &&
        !hasConfirmedCriticalSlots(state)
      ) {
        return block('order_confirmation_requires_confirmed_critical_slots');
      }
      return { valid: true };
    case 'add_to_cart':
      return { valid: true };
    case 'remove_from_cart':
    case 'update_cart_item':
    case 'clear_cart':
    case 'update_draft':
    case 'escalate':
    case 'select_skill':
      return { valid: true };
  }
}
