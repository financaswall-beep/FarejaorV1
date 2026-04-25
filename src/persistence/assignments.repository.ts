import type { PoolClient } from 'pg';
import type { MappedAssignment } from '../normalization/assignment.mapper.js';

export async function insertAssignment(
  client: PoolClient,
  assignment: MappedAssignment,
  conversationId: string,
): Promise<void> {
  await client.query(
    `WITH input AS (
      SELECT
        $1::env_t AS environment,
        $2::uuid AS conversation_id,
        $3::bigint AS agent_id,
        $4::bigint AS team_id,
        $5::timestamptz AS assigned_at
    )
    INSERT INTO core.conversation_assignments (
      environment, conversation_id, agent_id, team_id, assigned_at
    )
    SELECT environment, conversation_id, agent_id, team_id, assigned_at
    FROM input
    WHERE NOT EXISTS (
      SELECT 1
      FROM core.conversation_assignments
      WHERE environment = input.environment
        AND conversation_id = input.conversation_id
        AND agent_id = input.agent_id
        AND team_id IS NOT DISTINCT FROM input.team_id
        AND assigned_at = input.assigned_at
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
