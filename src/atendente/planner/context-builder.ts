import type { PoolClient } from 'pg';
import type { Environment } from '../../shared/types/chatwoot.js';
import type { ConversationState } from '../../shared/zod/agent-state.js';
import { loadCurrent } from '../state/agent-state.repository.js';
import type { ToolName } from './schemas.js';

export interface PlannerMessage {
  id: string;
  role: 'customer' | 'agent' | 'system';
  text: string;
  sent_at: string;
}

export interface ToolResultSummary {
  tool: ToolName;
  ok: boolean;
  summary: string;
  occurred_at: string;
}

export interface PlannerContext {
  environment: Environment;
  conversation_id: string;
  state: ConversationState;
  recent_messages: PlannerMessage[];
  available_tools: ToolName[];
  recent_tool_results: ToolResultSummary[];
  derived_signals: ConversationState['derived_signals'];
}

export async function buildPlannerContext(
  client: PoolClient,
  environment: Environment,
  conversationId: string,
): Promise<PlannerContext> {
  const state = await loadCurrent(client, environment, conversationId);
  if (!state) {
    throw new Error(`planner_context_missing_state:${conversationId}`);
  }

  const [messages, toolResults] = await Promise.all([
    client.query<{
      id: string;
      sender_type: string;
      message_type: string;
      content: string;
      sent_at: Date;
    }>(
      `SELECT id, sender_type, message_type, content, sent_at
       FROM core.messages
       WHERE environment = $1
         AND conversation_id = $2
         AND is_private = false
         AND content IS NOT NULL
         AND content != ''
       ORDER BY sent_at DESC
       LIMIT 10`,
      [environment, conversationId],
    ),
    client.query<{
      event_payload: Record<string, unknown>;
      occurred_at: Date;
    }>(
      `SELECT event_payload, occurred_at
       FROM agent.session_events
       WHERE environment = $1
         AND conversation_id = $2
         AND event_type = 'planner_decided'
       ORDER BY occurred_at DESC
       LIMIT 3`,
      [environment, conversationId],
    ),
  ]);

  return {
    environment,
    conversation_id: conversationId,
    state,
    recent_messages: messages.rows.reverse().map((message) => ({
      id: message.id,
      role: mapSenderRole(message.sender_type),
      text: message.content,
      sent_at: message.sent_at.toISOString(),
    })),
    available_tools: [
      'buscarProduto',
      'verificarEstoque',
      'buscarCompatibilidade',
      'calcularFrete',
      'buscarPoliticaComercial',
    ],
    recent_tool_results: toolResults.rows.map((row) => ({
      tool: 'buscarProduto',
      ok: true,
      summary: JSON.stringify(row.event_payload).slice(0, 300),
      occurred_at: row.occurred_at.toISOString(),
    })),
    derived_signals: state.derived_signals,
  };
}

function mapSenderRole(senderType: string): PlannerMessage['role'] {
  if (senderType === 'contact') return 'customer';
  if (senderType === 'user' || senderType === 'agent') return 'agent';
  return 'system';
}
