export interface MappedReaction {
  environment: string;
  chatwootMessageId: number;
  reactorType: string;
  reactorId: number | null;
  emoji: string;
  reactedAt: Date;
}

export function mapReaction(
  _payload: unknown,
  _environment: string,
  _lastEventAt: Date,
): MappedReaction | null {
  // Reactions are not present in Phase 1 webhook fixtures;
  // mapper returns null as a placeholder for future phases.
  return null;
}
