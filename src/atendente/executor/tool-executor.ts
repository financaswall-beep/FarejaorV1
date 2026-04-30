import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  buscarCompatibilidade,
  buscarPoliticaComercial,
  buscarProduto,
  calcularFrete,
  verificarEstoque,
} from '../tools/commerce-tools.js';
import type { PlannerContext } from '../planner/context-builder.js';
import type { ToolRequest, ToolName } from '../planner/schemas.js';

export interface ToolExecutionResult {
  tool: ToolName;
  input: unknown;
  output: unknown;
  ok: boolean;
  duration_ms: number;
  error_message: string | null;
}

export async function executeToolRequests(
  client: PoolClient,
  requests: ToolRequest[],
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];
  for (const request of requests) {
    results.push(await executeToolRequest(client, request));
  }
  return results;
}

export async function executeToolRequest(
  client: PoolClient,
  request: ToolRequest,
): Promise<ToolExecutionResult> {
  const startedAt = Date.now();
  try {
    const output = await dispatchTool(client, request);
    return {
      tool: request.tool,
      input: request.input,
      output,
      ok: true,
      duration_ms: Date.now() - startedAt,
      error_message: null,
    };
  } catch (error) {
    return {
      tool: request.tool,
      input: request.input,
      output: null,
      ok: false,
      duration_ms: Date.now() - startedAt,
      error_message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function recordToolExecutionResults(
  client: PoolClient,
  context: PlannerContext,
  results: ToolExecutionResult[],
): Promise<void> {
  for (const [index, result] of results.entries()) {
    await client.query(
      `INSERT INTO agent.session_events
         (environment, conversation_id, turn_index, event_type, event_payload, emitted_by, action_id)
       VALUES ($1, $2, $3, $4, $5, 'system', $6)
       ON CONFLICT (action_id) DO NOTHING`,
      [
        context.environment,
        context.conversation_id,
        context.state.turn_index + 1,
        result.ok ? 'tool_executed' : 'tool_failed',
        JSON.stringify({
          tool: result.tool,
          input: result.input,
          output: result.output,
          ok: result.ok,
          duration_ms: result.duration_ms,
          error_message: result.error_message,
        }),
        deterministicActionId([
          'tool_execution',
          context.environment,
          context.conversation_id,
          context.state.turn_index + 1,
          index,
          result.tool,
          result.input,
          result.ok,
        ]),
      ],
    );
  }
}

async function dispatchTool(client: PoolClient, request: ToolRequest): Promise<unknown> {
  switch (request.tool) {
    case 'buscarProduto':
      return buscarProduto(client, request.input);
    case 'verificarEstoque':
      return verificarEstoque(client, request.input);
    case 'buscarCompatibilidade':
      return buscarCompatibilidade(client, request.input);
    case 'calcularFrete':
      return calcularFrete(client, request.input);
    case 'buscarPoliticaComercial':
      return buscarPoliticaComercial(client, request.input);
  }
}

function deterministicActionId(parts: unknown[]): string {
  const hash = createHash('sha256').update(stableStringify(parts)).digest('hex');
  const variant = ((Number.parseInt(hash[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(
    17,
    20,
  )}-${hash.slice(20, 32)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
}
