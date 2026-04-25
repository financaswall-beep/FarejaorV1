import { describe, expect, it, vi } from 'vitest';
import { insertAssignment } from '../../../src/persistence/assignments.repository.js';
import { insertStatusEvent } from '../../../src/persistence/status-events.repository.js';

describe('auxiliary event repositories', () => {
  it('inserts status events idempotently with a logical existence check', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const occurredAt = new Date('2026-04-23T12:00:00Z');

    await insertStatusEvent(
      client as never,
      {
        environment: 'prod',
        chatwootConversationId: 101,
        eventType: 'status_changed',
        fromValue: 'open',
        toValue: 'resolved',
        changedById: null,
        changedByType: null,
        occurredAt,
        rawEventId: 7,
      },
      'conversation-uuid',
    );

    const sql = client.query.mock.calls[0][0] as string;
    expect(sql).toContain('WITH input AS');
    expect(sql).toContain('$1::env_t AS environment');
    expect(sql).toContain('WHERE NOT EXISTS');
    expect(sql).toContain('raw_event_id IS NOT DISTINCT FROM input.raw_event_id');
  });

  it('inserts assignments idempotently with a logical existence check', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const assignedAt = new Date('2026-04-23T12:00:00Z');

    await insertAssignment(
      client as never,
      {
        environment: 'prod',
        chatwootConversationId: 101,
        agentId: 42,
        teamId: 3,
        assignedAt,
      },
      'conversation-uuid',
    );

    const sql = client.query.mock.calls[0][0] as string;
    expect(sql).toContain('WITH input AS');
    expect(sql).toContain('$1::env_t AS environment');
    expect(sql).toContain('WHERE NOT EXISTS');
    expect(sql).toContain('team_id IS NOT DISTINCT FROM input.team_id');
  });
});
