import type { ChatwootMessage } from '../shared/types/chatwoot.js';

export interface MappedMessage {
  environment: string;
  chatwootMessageId: number;
  chatwootAccountId: number;
  chatwootInboxId: number | null;
  chatwootConversationId: number;
  senderType: string;
  senderId: number | null;
  messageType: number;
  content: string | null;
  contentType: string | null;
  contentAttributes: Record<string, unknown>;
  isPrivate: boolean;
  status: string | null;
  externalSourceIds: Record<string, unknown> | null;
  echoId: string | null;
  sentAt: Date;
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

function normalizeMessageType(mt: unknown): number {
  if (typeof mt === 'number') return mt;
  const map: Record<string, number> = {
    incoming: 0,
    outgoing: 1,
    activity: 2,
    template: 3,
  };
  if (typeof mt === 'string') {
    const mapped = map[mt as keyof typeof map];
    if (mapped !== undefined) return mapped;
  }
  return 0;
}

function normalizeSenderType(st: unknown): string {
  if (typeof st !== 'string') return 'system';
  const lower = st.toLowerCase();
  const valid = ['contact', 'user', 'agent_bot', 'system'];
  return valid.includes(lower) ? lower : 'system';
}

export function mapMessage(
  payload: unknown,
  environment: string,
  lastEventAt: Date,
): MappedMessage {
  const p = payload as ChatwootMessage;

  const senderType = normalizeSenderType(p.sender_type);

  let senderId: number | null = p.sender_id ?? null;
  if (
    senderId == null &&
    p.sender &&
    typeof p.sender === 'object' &&
    Object.keys(p.sender).length > 0
  ) {
    const s = p.sender as { id?: number };
    senderId = s.id ?? null;
  }

  const messageType = normalizeMessageType(p.message_type);
  const sentAt = parseTimestamp(p.created_at) ?? lastEventAt;

  return {
    environment,
    chatwootMessageId: p.id,
    chatwootAccountId: p.account_id ?? 0,
    chatwootInboxId: p.inbox_id ?? null,
    chatwootConversationId: p.conversation_id ?? 0,
    senderType,
    senderId,
    messageType,
    content: p.content ?? null,
    contentType: p.content_type ?? null,
    contentAttributes: (p.content_attributes ?? {}) as Record<string, unknown>,
    isPrivate: p.private ?? false,
    status: p.status ?? null,
    externalSourceIds: p.external_source_ids
      ? (p.external_source_ids as Record<string, unknown>)
      : null,
    echoId: p.echo_id ?? null,
    sentAt,
    lastEventAt,
  };
}
