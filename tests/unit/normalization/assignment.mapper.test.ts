import { describe, it, expect } from 'vitest';
import { mapAssignment } from '../../../src/normalization/assignment.mapper.js';

const environment = 'prod';
const assignedAt = new Date('2026-04-23T12:05:00Z');

describe('assignment.mapper', () => {
  it('maps assignment when assignee_id is present', () => {
    const result = mapAssignment(
      { id: 101, assignee_id: 42, team_id: 3 },
      environment,
      assignedAt,
    );

    expect(result).not.toBeNull();
    expect(result!.chatwootConversationId).toBe(101);
    expect(result!.agentId).toBe(42);
    expect(result!.teamId).toBe(3);
    expect(result!.assignedAt).toEqual(assignedAt);
  });

  it('returns null when assignee_id is null', () => {
    const result = mapAssignment(
      { id: 101, assignee_id: null, team_id: 3 },
      environment,
      assignedAt,
    );
    expect(result).toBeNull();
  });

  it('returns null when assignee_id is undefined', () => {
    const result = mapAssignment({ id: 101 }, environment, assignedAt);
    expect(result).toBeNull();
  });
});
