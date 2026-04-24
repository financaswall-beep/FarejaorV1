export interface MappedAssignment {
  environment: string;
  chatwootConversationId: number;
  agentId: number;
  teamId: number | null;
  assignedAt: Date;
}

export function mapAssignment(
  payload: {
    id: number;
    assignee_id?: number | null;
    team_id?: number | null;
    updated_at?: unknown;
  },
  environment: string,
  assignedAt: Date,
): MappedAssignment | null {
  if (payload.assignee_id == null) return null;

  return {
    environment,
    chatwootConversationId: payload.id,
    agentId: payload.assignee_id,
    teamId: payload.team_id ?? null,
    assignedAt,
  };
}
