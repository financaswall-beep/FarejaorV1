import { describe, it, expect } from 'vitest';
import { mapContact } from '../../../src/normalization/contact.mapper.js';
import contactCreated from '../../fixtures/chatwoot/contact_created.json';
import contactUpdated from '../../fixtures/chatwoot/contact_updated.json';

const environment = 'prod';
const lastEventAt = new Date('2026-04-23T12:00:00Z');

describe('contact.mapper', () => {
  it('maps contact_created fixture correctly', () => {
    const result = mapContact(contactCreated, environment, lastEventAt);

    expect(result.environment).toBe('prod');
    expect(result.chatwootContactId).toBe(201);
    expect(result.name).toBe('TEST NAME 1');
    expect(result.phoneE164).toBe('+5521999990001');
    expect(result.email).toBe('test+1@example.com');
    expect(result.identifier).toBeNull();
    expect(result.customAttributes).toEqual({});
    expect(result.lastEventAt).toEqual(lastEventAt);
  });

  it('maps contact_updated fixture correctly', () => {
    const result = mapContact(contactUpdated, environment, lastEventAt);

    expect(result.chatwootContactId).toBe(201);
    expect(result.name).toBe('TEST NAME 1 UPDATED');
    expect(result.phoneE164).toBe('+5521999990002');
    expect(result.customAttributes).toEqual({ vip: true });
  });
});
