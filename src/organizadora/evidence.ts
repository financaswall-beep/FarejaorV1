import type { ExtractedFact } from '../shared/zod/llm-organizadora.js';

export type EvidenceValidationResult =
  | { ok: true }
  | { ok: false; error: 'message_not_in_conversation' | 'evidence_not_literal'; messageContent?: string };

export function validateFactEvidence(
  fact: Pick<ExtractedFact, 'from_message_id' | 'evidence_text'>,
  messages: Array<{ id: string; content: string | null }>,
): EvidenceValidationResult {
  const message = messages.find((item) => item.id === fact.from_message_id);
  if (!message) {
    return { ok: false, error: 'message_not_in_conversation' };
  }

  const evidenceText = fact.evidence_text.trim();
  const messageContent = message.content ?? '';

  if (!messageContent.includes(evidenceText)) {
    return { ok: false, error: 'evidence_not_literal', messageContent };
  }

  return { ok: true };
}
