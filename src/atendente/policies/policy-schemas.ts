import { z } from 'zod';

export const policyValueSchemas = {
  desconto_maximo: z.object({
    pct: z.number().min(0).max(100),
    max_value_brl: z.number().min(0).optional(),
  }),
  formas_pagamento_aceitas: z.array(z.string().trim().min(1)).min(1),
  prazo_garantia_pneus: z.object({
    days: z.number().int().min(0),
  }),
  free_shipping_threshold: z.object({
    min_value_brl: z.number().min(0),
  }),
  parcelamento_maximo: z.object({
    installments: z.number().int().min(1),
    min_installment_brl: z.number().min(0).optional(),
  }),
} as const;

export type KnownPolicyKey = keyof typeof policyValueSchemas;

export function isKnownPolicyKey(policyKey: string): policyKey is KnownPolicyKey {
  return Object.prototype.hasOwnProperty.call(policyValueSchemas, policyKey);
}

export function parsePolicyValue(policyKey: string, value: unknown): unknown {
  if (!isKnownPolicyKey(policyKey)) {
    throw new Error(`unsupported_policy_key:${policyKey}`);
  }
  return policyValueSchemas[policyKey].parse(value);
}
