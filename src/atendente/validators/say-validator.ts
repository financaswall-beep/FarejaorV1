import { collectDeliveryFees, collectToolPrices, type ToolResultForValidation } from './tool-results.js';

export type SayValidationResult =
  | { valid: true }
  | { valid: false; reason: string; severity: 'block' | 'warn' };

export interface SayValidationContext {
  recent_tool_results: ToolResultForValidation[];
}

export function validateSay(say: string, context: SayValidationContext): SayValidationResult {
  const mentionedMoney = extractMoneyValues(say);
  if (mentionedMoney.length === 0) return { valid: true };

  const knownPrices = collectToolPrices(context.recent_tool_results);
  const knownFees = collectDeliveryFees(context.recent_tool_results);
  const knownAmounts = new Set([...knownPrices, ...knownFees]);
  if (knownAmounts.size === 0) {
    return block('money_mentioned_without_tool_result');
  }

  for (const amount of mentionedMoney) {
    if (!hasApproxAmount(knownAmounts, amount)) {
      return block(`money_not_supported_by_tool_result:${amount}`);
    }
  }
  return { valid: true };
}

function block(reason: string): SayValidationResult {
  return { valid: false, reason, severity: 'block' };
}

function extractMoneyValues(text: string): number[] {
  const out: number[] = [];
  const moneyPattern = /(?:r\$\s*)?(\d{1,5})(?:[,.](\d{2}))?/gi;
  for (const match of text.matchAll(moneyPattern)) {
    const hasCurrency = match[0].toLowerCase().includes('r$');
    if (!hasCurrency) continue;
    const whole = match[1];
    if (!whole) continue;
    const cents = match[2] ?? '00';
    const amount = Number(`${whole}.${cents}`);
    if (Number.isFinite(amount)) out.push(amount);
  }
  return out;
}

function hasApproxAmount(values: Set<number>, amount: number): boolean {
  for (const value of values) {
    if (Math.abs(value - amount) < 0.01) return true;
  }
  return false;
}
