import type { ToolName } from '../planner/schemas.js';

export interface ToolResultForValidation {
  tool: ToolName;
  ok: boolean;
  output: unknown;
}

export function collectToolProductIds(results: ToolResultForValidation[]): Set<string> {
  const ids = new Set<string>();
  for (const result of results.filter((item) => item.ok)) {
    collectProductIds(result.output, ids);
  }
  return ids;
}

export function collectToolPrices(results: ToolResultForValidation[]): Set<number> {
  const prices = new Set<number>();
  for (const result of results.filter((item) => item.ok)) {
    collectPrices(result.output, prices);
  }
  return prices;
}

export function collectDeliveryFees(results: ToolResultForValidation[]): Set<number> {
  const fees = new Set<number>();
  for (const result of results.filter((item) => item.ok && item.tool === 'calcularFrete')) {
    collectFieldNumbers(result.output, 'valor', fees);
  }
  return fees;
}

function collectProductIds(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectProductIds(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (typeof record.product_id === 'string') out.add(record.product_id);
  for (const nested of Object.values(record)) collectProductIds(nested, out);
}

function collectPrices(value: unknown, out: Set<number>): void {
  collectFieldNumbers(value, 'price_amount', out);
  collectFieldNumbers(value, 'current_price', out);
}

function collectFieldNumbers(value: unknown, field: string, out: Set<number>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectFieldNumbers(item, field, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (typeof record[field] === 'string' || typeof record[field] === 'number') {
    const parsed = Number(record[field]);
    if (Number.isFinite(parsed)) out.add(parsed);
  }
  for (const nested of Object.values(record)) collectFieldNumbers(nested, field, out);
}
