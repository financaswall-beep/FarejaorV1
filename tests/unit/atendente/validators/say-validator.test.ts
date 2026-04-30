import { describe, expect, it } from 'vitest';
import { validateSay } from '../../../../src/atendente/validators/say-validator.js';

describe('SayValidator inicial', () => {
  it('bloqueia dinheiro citado sem resultado de tool', () => {
    expect(validateSay('Esse pneu sai por R$ 175,00', { recent_tool_results: [] })).toMatchObject({
      valid: false,
      reason: 'money_mentioned_without_tool_result',
    });
  });

  it('permite preco vindo de buscarProduto', () => {
    expect(
      validateSay('Esse pneu sai por R$ 175,00', {
        recent_tool_results: [
          {
            tool: 'buscarProduto',
            ok: true,
            output: [{ product_id: 'p1', price_amount: '175.00' }],
          },
        ],
      }),
    ).toEqual({ valid: true });
  });

  it('entende separador de milhar em valores monetarios', () => {
    expect(
      validateSay('O jogo completo fica em R$ 1.750,00', {
        recent_tool_results: [
          {
            tool: 'buscarProduto',
            ok: true,
            output: [{ product_id: 'p1', price_amount: '1750.00' }],
          },
        ],
      }),
    ).toEqual({ valid: true });
  });

  it('bloqueia preco inventado diferente do resultado da tool', () => {
    expect(
      validateSay('Esse pneu sai por R$ 180,00', {
        recent_tool_results: [
          {
            tool: 'buscarProduto',
            ok: true,
            output: [{ product_id: 'p1', price_amount: '175.00' }],
          },
        ],
      }),
    ).toMatchObject({
      valid: false,
      reason: 'money_not_supported_by_tool_result:180',
    });
  });
});
