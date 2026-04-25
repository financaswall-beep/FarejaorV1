import { describe, expect, it } from 'vitest';
import scenarios from '../../fixtures/business/tire_sales_scenarios.json';
import { chatwootWebhookEnvelopeSchema } from '../../../src/shared/types/chatwoot.js';

type TireSalesScenario = {
  scenario_id: string;
  title: string;
  expected_future_labels: {
    stage_reached: string;
    final_outcome: string;
    loss_reason: string | null;
  };
  events: unknown[];
};

describe('tire sales synthetic scenarios', () => {
  it('covers at least the essential business outcomes', () => {
    const typedScenarios = scenarios as TireSalesScenario[];
    const outcomes = new Set(
      typedScenarios.map((scenario) => scenario.expected_future_labels.final_outcome),
    );
    const lossReasons = new Set(
      typedScenarios.map((scenario) => scenario.expected_future_labels.loss_reason),
    );

    expect(typedScenarios.length).toBeGreaterThanOrEqual(8);
    expect(outcomes).toContain('venda_concretizada');
    expect(outcomes).toContain('venda_perdida');
    expect(outcomes).toContain('abandono');
    expect(lossReasons).toContain('preco');
    expect(lossReasons).toContain('falta_estoque');
    expect(lossReasons).toContain('abandono_carrinho');
  });

  it('keeps every synthetic event compatible with the Chatwoot webhook envelope', () => {
    const typedScenarios = scenarios as TireSalesScenario[];

    for (const scenario of typedScenarios) {
      expect(scenario.scenario_id).toMatch(/^tire_/);
      expect(scenario.events.length).toBeGreaterThanOrEqual(2);

      for (const event of scenario.events) {
        expect(() => chatwootWebhookEnvelopeSchema.parse(event)).not.toThrow();
      }
    }
  });
});
