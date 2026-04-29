import { describe, expect, it } from 'vitest';
import { validateFactEvidence } from '../../../src/organizadora/evidence.js';

describe('validateFactEvidence', () => {
  const messages = [
    { id: '11111111-1111-4111-8111-111111111111', content: 'quero um pneu pra minha bros traseiro' },
    { id: '22222222-2222-4222-8222-222222222222', content: 'a medida e 140/70-17' },
  ];

  it('accepts literal evidence from the referenced message', () => {
    const result = validateFactEvidence(
      {
        from_message_id: messages[0]!.id,
        evidence_text: 'bros traseiro',
      },
      messages,
    );

    expect(result).toEqual({ ok: true });
  });

  it('rejects a message id outside the conversation', () => {
    const result = validateFactEvidence(
      {
        from_message_id: '33333333-3333-4333-8333-333333333333',
        evidence_text: 'bros',
      },
      messages,
    );

    expect(result).toEqual({ ok: false, error: 'message_not_in_conversation' });
  });

  it('rejects paraphrased evidence', () => {
    const result = validateFactEvidence(
      {
        from_message_id: messages[0]!.id,
        evidence_text: 'cliente pediu pneu para Bros',
      },
      messages,
    );

    expect(result).toMatchObject({ ok: false, error: 'evidence_not_literal' });
  });
});
