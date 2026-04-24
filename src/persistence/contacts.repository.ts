import type { PoolClient } from 'pg';
import type { MappedContact } from '../normalization/contact.mapper.js';

export async function upsertContact(
  client: PoolClient,
  contact: MappedContact,
): Promise<void> {
  await client.query(
    `INSERT INTO core.contacts (
      environment, chatwoot_contact_id, name, phone_e164, email, identifier,
      channel_type, country, city, custom_attributes, first_seen_at, last_seen_at, last_event_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (environment, chatwoot_contact_id) DO UPDATE
    SET name = EXCLUDED.name,
        phone_e164 = EXCLUDED.phone_e164,
        email = EXCLUDED.email,
        identifier = EXCLUDED.identifier,
        channel_type = EXCLUDED.channel_type,
        country = EXCLUDED.country,
        city = EXCLUDED.city,
        custom_attributes = EXCLUDED.custom_attributes,
        first_seen_at = EXCLUDED.first_seen_at,
        last_seen_at = EXCLUDED.last_seen_at,
        last_event_at = EXCLUDED.last_event_at,
        updated_at = now()
    WHERE core.contacts.last_event_at IS NULL
       OR EXCLUDED.last_event_at >= core.contacts.last_event_at`,
    [
      contact.environment,
      contact.chatwootContactId,
      contact.name,
      contact.phoneE164,
      contact.email,
      contact.identifier,
      contact.channelType,
      contact.country,
      contact.city,
      JSON.stringify(contact.customAttributes),
      contact.firstSeenAt,
      contact.lastSeenAt,
      contact.lastEventAt,
    ],
  );
}
