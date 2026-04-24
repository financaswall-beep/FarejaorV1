export interface MappedTag {
  environment: string;
  chatwootConversationId: number;
  label: string;
  addedAt: Date;
  addedByType: string | null;
}

export function mapTags(
  payload: { id: number; labels?: string[] },
  environment: string,
  addedAt: Date,
): MappedTag[] {
  const labels = payload.labels ?? [];
  return labels.map((label) => ({
    environment,
    chatwootConversationId: payload.id,
    label,
    addedAt,
    addedByType: null,
  }));
}
