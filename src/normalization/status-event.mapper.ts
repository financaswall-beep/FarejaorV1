export interface MappedStatusEvent {
  environment: string;
  chatwootConversationId: number;
  eventType: string;
  fromValue: string | null;
  toValue: string | null;
  changedById: number | null;
  changedByType: string | null;
  occurredAt: Date;
  rawEventId: number | null;
}

export function mapStatusEvent(
  payload: { id: number; status?: string; updated_at?: unknown },
  environment: string,
  occurredAt: Date,
  rawEventId: number | null,
  previousStatus: string | null,
): MappedStatusEvent {
  return {
    environment,
    chatwootConversationId: payload.id,
    eventType: 'status_changed',
    fromValue: previousStatus,
    toValue: payload.status ?? null,
    changedById: null,
    changedByType: null,
    occurredAt,
    rawEventId,
  };
}
