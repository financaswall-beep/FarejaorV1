import { createHash } from 'node:crypto';

export function deterministicUuid(parts: unknown[]): string {
  const hash = createHash('sha256').update(stableStringify(parts)).digest('hex');
  const variant = ((Number.parseInt(hash[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(
    17,
    20,
  )}-${hash.slice(20, 32)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
}
