import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  routingSchema,
  rulesetSchema,
  lexiconSchema,
  type LoadedSegment,
  type Routing,
  type Ruleset,
  type Lexicon,
} from './rules.types.js';

const SEGMENTS_BASE = resolve(process.cwd(), 'segments');

function segmentDir(segment: string): string {
  return join(SEGMENTS_BASE, segment);
}

export async function loadRouting(): Promise<Routing> {
  const raw = await readFile(join(SEGMENTS_BASE, 'routing.json'), 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  return routingSchema.parse(parsed);
}

export function resolveSegment(
  routing: Routing,
  environment: string,
  chatwootAccountId: number,
  chatwootInboxId: number | null | undefined,
): string {
  // Exact match with inbox first
  if (chatwootInboxId != null) {
    const exact = routing.routes.find(
      (r) =>
        r.environment === environment &&
        r.chatwoot_account_id === chatwootAccountId &&
        r.chatwoot_inbox_id === chatwootInboxId,
    );
    if (exact) return exact.segment;
  }

  // Match by account (inbox null or not specified)
  const accountRoute = routing.routes.find(
    (r) =>
      r.environment === environment &&
      r.chatwoot_account_id === chatwootAccountId &&
      (r.chatwoot_inbox_id == null),
  );
  if (accountRoute) return accountRoute.segment;

  return routing.defaultSegment;
}

export async function loadRuleset(segment: string): Promise<Ruleset> {
  const dir = segmentDir(segment);
  const raw = await readFile(join(dir, 'rules.json'), 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  return rulesetSchema.parse(parsed);
}

export async function loadLexicon(segment: string): Promise<Lexicon> {
  const dir = segmentDir(segment);
  const raw = await readFile(join(dir, 'lexicon.json'), 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  return lexiconSchema.parse(parsed);
}

export async function computeRulesetHash(segment: string): Promise<string> {
  const dir = segmentDir(segment);
  const rulesBytes = await readFile(join(dir, 'rules.json'));
  const lexiconBytes = await readFile(join(dir, 'lexicon.json'));

  const hash = createHash('sha256');
  hash.update(rulesBytes);
  hash.update('\n');
  hash.update(lexiconBytes);

  return hash.digest('hex');
}

export async function loadSegment(segment: string): Promise<LoadedSegment> {
  const [ruleset, lexicon, rulesetHash] = await Promise.all([
    loadRuleset(segment),
    loadLexicon(segment),
    computeRulesetHash(segment),
  ]);

  if (ruleset.segment !== segment) {
    throw new Error(`Segment mismatch: expected ${segment}, got ${ruleset.segment}`);
  }

  if (lexicon.locale !== ruleset.locale) {
    throw new Error(`Locale mismatch in segment ${segment}: rules=${ruleset.locale}, lexicon=${lexicon.locale}`);
  }

  return {
    segment,
    ruleset,
    lexicon,
    rulesetHash,
  };
}
