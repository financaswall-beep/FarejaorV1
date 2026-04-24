import { describe, it, expect } from 'vitest';
import { mapStatusEvent } from '../../../src/normalization/status-event.mapper.js';

const environment = 'prod';
const occurredAt = new Date('2026-04-23T12:10:00Z');

describe('status-event.mapper', () => {
  it('maps status change with previous value', () => {
    const result = mapStatusEvent(
      { id: 101, status: 'pending' },
      environment,
      occurredAt,
      123,
      'open',
    );

    expect(result.environment).toBe('prod');
    expect(result.chatwootConversationId).toBe(101);
    expect(result.eventType).toBe('status_changed');
    expect(result.fromValue).toBe('open');
    expect(result.toValue).toBe('pending');
    expect(result.occurredAt).toEqual(occurredAt);
    expect(result.rawEventId).toBe(123);
  });

  it('maps status change without previous value', () => {
    const result = mapStatusEvent(
      { id: 101, status: 'resolved' },
      environment,
      occurredAt,
      null,
      null,
    );

    expect(result.fromValue).toBeNull();
    expect(result.toValue).toBe('resolved');
  });
});
