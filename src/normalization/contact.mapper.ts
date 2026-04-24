import type { ChatwootContact } from '../shared/types/chatwoot.js';

export interface MappedContact {
  environment: string;
  chatwootContactId: number;
  name: string | null;
  phoneE164: string | null;
  email: string | null;
  identifier: string | null;
  channelType: string | null;
  country: string | null;
  city: string | null;
  customAttributes: Record<string, unknown>;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  lastEventAt: Date;
}

export function mapContact(
  payload: unknown,
  environment: string,
  lastEventAt: Date,
): MappedContact {
  const p = payload as ChatwootContact;

  const additionalAttributes = (p.additional_attributes ?? {}) as Record<string, unknown>;
  const customAttributes = (p.custom_attributes ?? {}) as Record<string, unknown>;

  return {
    environment,
    chatwootContactId: p.id,
    name: p.name ?? null,
    phoneE164: p.phone_number ?? null,
    email: p.email ?? null,
    identifier: p.identifier ?? null,
    channelType: (additionalAttributes.channel as string) ?? null,
    country: (additionalAttributes.country as string) ?? null,
    city: (additionalAttributes.city as string) ?? null,
    customAttributes,
    firstSeenAt: null,
    lastSeenAt: null,
    lastEventAt,
  };
}
