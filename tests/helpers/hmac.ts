import { createHmac } from 'node:crypto';

/**
 * Gera uma assinatura HMAC-SHA256 compatível com o header
 * `X-Chatwoot-Signature` enviado pelo Chatwoot.
 *
 * Útil em testes de integração do webhook handler (F1-01).
 */
export function generateChatwootSignature(
  payload: string,
  secret: string
): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Gera os headers mínimos exigidos pelo webhook handler em testes.
 */
export function generateChatwootHeaders(
  payload: string,
  secret: string,
  deliveryId: string,
  timestamp?: string
): Record<string, string> {
  const sig = generateChatwootSignature(payload, secret);
  const headers: Record<string, string> = {
    'x-chatwoot-signature': sig,
    'x-chatwoot-delivery': deliveryId,
  };
  if (timestamp !== undefined) {
    headers['x-chatwoot-timestamp'] = timestamp;
  }
  return headers;
}
