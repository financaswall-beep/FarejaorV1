import { z } from 'zod';

// ------------------------------------------------------------
// Routing
// ------------------------------------------------------------

export const routeSchema = z.object({
  environment: z.enum(['prod', 'test']),
  chatwoot_account_id: z.number().int().positive(),
  chatwoot_inbox_id: z.number().int().positive().nullable().optional(),
  segment: z.string().min(1),
});

export const routingSchema = z.object({
  defaultSegment: z.string().min(1),
  routes: z.array(routeSchema),
});

export type Routing = z.infer<typeof routingSchema>;
export type Route = z.infer<typeof routeSchema>;

// ------------------------------------------------------------
// Rules
// ------------------------------------------------------------

export const baseRuleSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['keyword', 'regex', 'phrase_set']),
  target: z.enum(['hint', 'fact']),
  confidence_level: z.number().min(0).max(1),
});

export const keywordRuleSchema = baseRuleSchema.extend({
  type: z.literal('keyword'),
  target: z.literal('hint'),
  hint_type: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
});

export const regexRuleSchema = baseRuleSchema.extend({
  type: z.literal('regex'),
  target: z.enum(['hint', 'fact']),
  hint_type: z.string().optional(),
  fact_key: z.string().optional(),
  patterns: z.array(z.string().min(1)).min(1),
}).superRefine((rule, ctx) => {
  if (rule.target === 'hint' && !rule.hint_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hint_type'],
      message: 'regex hint rules require hint_type',
    });
  }

  if (rule.target === 'fact' && !rule.fact_key) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fact_key'],
      message: 'regex fact rules require fact_key',
    });
  }

  for (const [index, pattern] of rule.patterns.entries()) {
    try {
      new RegExp(pattern);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['patterns', index],
        message: 'invalid regex pattern',
      });
    }
  }
});

export const phraseSetRuleSchema = baseRuleSchema.extend({
  type: z.literal('phrase_set'),
  target: z.literal('hint'),
  hint_type: z.string().min(1),
  phrases: z.array(z.string().min(1)).min(1),
});

export const ruleSchema = z.union([keywordRuleSchema, regexRuleSchema, phraseSetRuleSchema]);

export const rulesetSchema = z.object({
  segment: z.string().min(1),
  locale: z.string().min(1),
  extractor_version: z.string().min(1),
  rules: z.array(ruleSchema),
}).superRefine((ruleset, ctx) => {
  const seen = new Set<string>();
  for (const [index, rule] of ruleset.rules.entries()) {
    if (seen.has(rule.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rules', index, 'id'],
        message: 'duplicate rule id',
      });
    }
    seen.add(rule.id);
  }
});

export type Rule = z.infer<typeof ruleSchema>;
export type KeywordRule = z.infer<typeof keywordRuleSchema>;
export type RegexRule = z.infer<typeof regexRuleSchema>;
export type PhraseSetRule = z.infer<typeof phraseSetRuleSchema>;
export type Ruleset = z.infer<typeof rulesetSchema>;

// ------------------------------------------------------------
// Lexicon
// ------------------------------------------------------------

export const lexiconSchema = z.object({
  locale: z.string().min(1),
  synonyms: z.record(z.array(z.string().min(1))),
  stopwords: z.array(z.string()),
});

export type Lexicon = z.infer<typeof lexiconSchema>;

// ------------------------------------------------------------
// Scenarios
// ------------------------------------------------------------

export const scenarioMessageSchema = z.object({
  sender_type: z.string(),
  content: z.string(),
});

export const scenarioSchema = z.object({
  name: z.string().min(1),
  messages: z.array(scenarioMessageSchema),
  expected_hints: z.array(z.string()),
});

export const scenariosSchema = z.object({
  scenarios: z.array(scenarioSchema),
});

export type Scenario = z.infer<typeof scenarioSchema>;

// ------------------------------------------------------------
// Loaded segment
// ------------------------------------------------------------

export interface LoadedSegment {
  segment: string;
  ruleset: Ruleset;
  lexicon: Lexicon;
  rulesetHash: string;
}

// ------------------------------------------------------------
// Engine output
// ------------------------------------------------------------

export interface Hint {
  conversation_id: string;
  environment: string;
  message_id: string;
  hint_type: string;
  matched_text: string | null;
  pattern_id: string;
  truth_type: string;
  source: string;
  confidence_level: number;
  extractor_version: string;
  ruleset_hash: string;
}

export interface Fact {
  environment: string;
  conversation_id: string;
  fact_key: string;
  fact_value: Record<string, unknown>;
  observed_at: Date | null;
  message_id: string | null;
  truth_type: string;
  source: string;
  confidence_level: number;
  extractor_version: string;
  ruleset_hash: string;
}
