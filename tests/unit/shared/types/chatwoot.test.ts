import { describe, it, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { chatwootWebhookEnvelopeSchema } from '@/shared/types/chatwoot';

const fixtureDir = resolve(__dirname, '../../../fixtures/chatwoot');

const fixtures = [
  { name: 'conversation_created' },
  { name: 'conversation_updated' },
  { name: 'conversation_status_changed' },
  { name: 'message_created' },
  { name: 'message_updated' },
  { name: 'contact_created' },
  { name: 'contact_updated' },
];

describe('chatwootWebhookEnvelopeSchema', () => {
  it.each(fixtures)('aceita o fixture $name sem erro', ({ name }) => {
    const raw = readFileSync(resolve(fixtureDir, `${name}.json`), 'utf-8');
    const payload = JSON.parse(raw);
    const result = chatwootWebhookEnvelopeSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  test('rejeita objeto sem campo "event"', () => {
    const payload = { id: 123, account: { id: 1 } };
    const result = chatwootWebhookEnvelopeSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
