import type { PoolClient } from 'pg';
import type { MappedAssignment } from '../normalization/assignment.mapper.js';

export async function insertAssignment(
  client: PoolClient,
  assignment: MappedAssignment,
  conversationId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO core.conversation_assignments (
      environment, conversation_id, agent_id, team_id, assigned_at
    )
    SELECT $1, $2, $3, $4, $5
    WHERE NOT EXISTS (
      SELECT 1
      FROM core.conversation_assignments
      WHERE environment = $1
        AND conversation_id = $2
        AND agent_id = $3
        AND team_id IS NOT DISTINCT FROM $4
        AND assigned_at = $5
    )`,
    [
      assignment.environment,
      conversationId,
      assignment.agentId,
      assignment.teamId,
      assignment.assignedAt,
    ],
  );
}
