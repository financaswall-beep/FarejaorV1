/**
 * Leitura de core.* para workers da Fase 3 (Organizadora, Atendente).
 *
 * Separado dos repositories de escrita da Fase 1 (persistence/).
 * Só SELECT — nunca modifica core.*.
 */

import type { PoolClient } from 'pg';
import type { Environment } from '../types/chatwoot.js';

// ------------------------------------------------------------------
// Mensagens de uma conversa para montar o prompt
// ------------------------------------------------------------------

export interface MessageForPrompt {
  id: string;
  sender_type: string;
  message_type: string;
  content: string | null;
  sent_at: Date;
}

/**
 * Retorna todas as mensagens de uma conversa em ordem cronológica.
 * Exclui mensagens privadas (notas internas do agente) e mensagens sem conteúdo.
 * Usado pela Organizadora para montar o prompt da LLM.
 */
export async function listMessagesForOrganizadora(
  client: PoolClient,
  environment: Environment,
  conversationId: string,
): Promise<MessageForPrompt[]> {
  const result = await client.query<MessageForPrompt>(
    `SELECT id, sender_type, message_type, content, sent_at
     FROM core.messages
     WHERE environment     = $1
       AND conversation_id = $2
       AND is_private      = false
       AND content        IS NOT NULL
       AND content        != ''
     ORDER BY sent_at ASC`,
    [environment, conversationId],
  );
  return result.rows;
}

/**
 * Retorna o id da última mensagem de uma conversa.
 * Usado para preencher last_message_id no job.
 */
export async function getLastMessageId(
  client: PoolClient,
  environment: Environment,
  conversationId: string,
): Promise<string | null> {
  const result = await client.query<{ id: string }>(
    `SELECT id
     FROM core.messages
     WHERE environment     = $1
       AND conversation_id = $2
     ORDER BY sent_at DESC
     LIMIT 1`,
    [environment, conversationId],
  );
  return result.rows[0]?.id ?? null;
}

// ------------------------------------------------------------------
// Dados do contato para contexto
// ------------------------------------------------------------------

export interface ContactForContext {
  id: string;
  name: string | null;
  phone_e164: string | null;
  city: string | null;
}

export async function getContactByConversationId(
  client: PoolClient,
  environment: Environment,
  conversationId: string,
): Promise<ContactForContext | null> {
  const result = await client.query<ContactForContext>(
    `SELECT c.id, c.name, c.phone_e164, c.city
     FROM core.contacts c
     JOIN core.conversations conv ON conv.contact_id = c.id
     WHERE conv.environment = $1
       AND conv.id          = $2
     LIMIT 1`,
    [environment, conversationId],
  );
  return result.rows[0] ?? null;
}
