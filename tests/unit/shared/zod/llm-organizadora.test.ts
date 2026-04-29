import { describe, expect, it } from 'vitest';
import { parseOrganizadoraResponse } from '../../../../src/shared/zod/llm-organizadora.js';

const messageId = '11111111-1111-4111-8111-111111111111';

describe('parseOrganizadoraResponse', () => {
  it('rejects non-json responses', () => {
    const result = parseOrganizadoraResponse('nao sou json', 'moto-pneus-v1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('llm_response_not_json');
  });

  it('rejects schema version mismatch', () => {
    const result = parseOrganizadoraResponse(
      JSON.stringify({ schema_version: 'outra-versao', facts: [] }),
      'moto-pneus-v1',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('schema_version_mismatch');
  });

  it('caps facts to 30', () => {
    const facts = Array.from({ length: 31 }, () => ({
      fact_key: 'moto_modelo',
      fact_value: 'Bros',
      from_message_id: messageId,
      evidence_text: 'Bros',
      truth_type: 'observed',
      confidence_level: 0.90,
      evidence_type: 'literal',
    }));

    const result = parseOrganizadoraResponse(
      JSON.stringify({ schema_version: 'moto-pneus-v1', facts }),
      'moto-pneus-v1',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('llm_response_schema_mismatch');
  });
});
