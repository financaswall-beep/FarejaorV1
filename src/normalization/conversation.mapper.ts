import type { ChatwootConversation } from '../shared/types/chatwoot.js';

export interface MappedConversation {
  environment: string;
  chatwootConversationId: number;
  chatwootAccountId: number;
  chatwootInboxId: number | null;
  channelType: string | null;
  chatwootContactId: number | null;
  currentStatus: string;
  currentAssigneeId: number | null;
  currentTeamId: number | null;
  priority: string | null;
  startedAt: Date;
  lastActivityAt: Date | null;
  resolvedAt: Date | null;
  waitingSince: Date | null;
  additionalAttributes: Record<string, unknown>;
  customAttributes: Record<string, unknown>;
  lastEventAt: Date;
}

function parseTimestamp(ts: unknown): Date | null {
  if (ts == null) return null;
  if (typeof ts === 'number') return new Date(ts * 1000);
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function mapConversation(
  payload: unknown,
  environment: string,
  lastEventAt: Date,
): MappedConversation {
  const p = payload as ChatwootConversation;

  const additionalAttributes = (p.additional_attributes ?? {}) as Record<string, unknown>;
  const customAttributes = (p.custom_attributes ?? {}) as Record<string, unknown>;

  const createdAt = parseTimestamp(p.created_at) ?? lastEventAt;
  const updatedAt = parseTimestamp(p.updated_at);
  const timestamp = parseTimestamp(p.timestamp);

  const resolvedAt =
    p.status === 'resolved' ? (updatedAt ?? timestamp ?? lastEventAt) : null;

  return {
    environment,
    chatwootConversationId: p.id,
    chatwootAccountId: p.account_id ?? 0,
    chatwootInboxId: p.inbox_id ?? null,
    channelType: (additionalAttributes.channel_type as string) ?? null,
    chatwootContactId: p.contact_id ?? null,
    currentStatus: p.status ?? 'open',
    currentAssigneeId: p.assignee_id ?? null,
    currentTeamId: p.team_id ?? null,
    priority: p.priority ?? null,
    startedAt: createdAt,
    lastActivityAt: updatedAt ?? timestamp ?? lastEventAt,
    resolvedAt,
    waitingSince: null,
    additionalAttributes,
    customAttributes,
    lastEventAt,
  };
}
