# F2A-02 - Motor generico de regras declarativas

## Objetivo

Criar o motor generico de regras da Fase 2a sem regra de pneu.

Esta task prepara o projeto para ser bifurcado como base reutilizavel, mas ainda
nao e a fronteira final do fork. A fronteira vem depois das classificacoes
genericas da F2A-03.

## Escopo

- Criar loader de regras declarativas.
- Criar schema Zod para validar ruleset, lexicon, scenarios e routing.
- Criar `segments/generic/` com exemplos neutros.
- Criar `segments/_template/` como segundo segmento de prova.
- Criar `segments/routing.json` com roteamento por `environment + chatwoot_account_id` e `chatwoot_inbox_id` opcional.
- Aplicar regras sobre mensagens de uma conversa.
- Gerar objetos prontos para `analytics.linguistic_hints` e
  `analytics.conversation_facts`.
- Criar migration nova para UNIQUE em `analytics.linguistic_hints`.
- Testar que trocar o segmento troca as regras sem alterar o motor.

## Arquivos que pode criar/alterar

- `db/migrations/0010_analytics_ruleset_auditability.sql`
- `src/enrichment/rules.loader.ts`
- `src/enrichment/rules.engine.ts`
- `src/enrichment/rules.types.ts`
- `src/enrichment/hints.repository.ts`
- `src/enrichment/facts.repository.ts`
- `segments/routing.json`
- `segments/generic/rules.json`
- `segments/generic/lexicon.json`
- `segments/generic/scenarios.json`
- `segments/generic/README.md`
- `segments/_template/rules.json`
- `segments/_template/lexicon.json`
- `segments/_template/scenarios.json`
- `segments/_template/README.md`
- `tests/unit/enrichment/rules.loader.test.ts`
- `tests/unit/enrichment/rules.engine.test.ts`
- `tests/unit/enrichment/hints.repository.test.ts`
- `tests/unit/enrichment/facts.repository.test.ts`
- `docs/tasks/F2A-02-generic-rule-engine.md`

Nao criar `segments/tires`.

## Estrutura obrigatoria do segmento

Cada segmento deve ter:

```text
segments/<segment>/
  rules.json
  lexicon.json
  scenarios.json
  README.md
```

Todo ruleset deve declarar:

```json
{
  "segment": "generic",
  "locale": "pt-BR",
  "extractor_version": "f2a_rules_v1"
}
```

## Roteamento de segmento

Criar:

```text
segments/routing.json
```

Formato:

```json
{
  "defaultSegment": "generic",
  "routes": [
    {
      "environment": "prod",
      "chatwoot_account_id": 1,
      "chatwoot_inbox_id": null,
      "segment": "generic"
    }
  ]
}
```

Regras:

- lookup por `environment + chatwoot_account_id`;
- se `chatwoot_inbox_id` estiver preenchido, a rota deve bater tambem por inbox;
- se `chatwoot_inbox_id` for `null` ou ausente, a rota vale para a conta inteira;
- fallback para `defaultSegment`;
- validar com Zod;
- nao decidir segmento por texto.

## Migration obrigatoria

Criar migration nova, sem alterar migrations antigas, para idempotencia e auditoria
de `analytics.linguistic_hints`.

Adicionar coluna:

```text
ruleset_hash TEXT NOT NULL DEFAULT 'pre_audit_v1'
```

O hash deve ser:

```text
sha256(bytes(rules.json) + "\n" + bytes(lexicon.json))
```

Definicao:

- ler bytes brutos dos arquivos no disco;
- nao fazer parse/reserializacao JSON para calcular hash;
- usar exatamente a ordem `rules.json`, newline, `lexicon.json`;
- `scenarios.json` nao entra no hash porque e fixture/documentacao, nao entrada do
  motor de inferencia.

Chave sugerida:

```text
(environment, conversation_id, message_id, hint_type, pattern_id, source, extractor_version, ruleset_hash)
```

Repository deve usar `ON CONFLICT DO NOTHING` ou `ON CONFLICT ... DO UPDATE` quando
fizer sentido.

Para `analytics.conversation_facts`, a mesma migration deve adicionar:

```text
ruleset_hash TEXT NOT NULL DEFAULT 'pre_audit_v1'
```

Nao alterar migration antiga. A sentinela `pre_audit_v1` significa "linha criada
antes de existir auditoria por ruleset_hash". Novas linhas geradas pelo motor de
regras devem gravar o SHA-256 real.

Depois do backfill, manter o default e aceitavel para inserts manuais antigos, mas
repositories da F2A-02 devem sempre enviar o hash real.

## Regras permitidas antes do fork

Permitido:

- termos genericos como "preco", "valor", "urgente", "hoje", "mais barato",
  "fechar", "comprar";
- categorias genericas como `price_complaint`, `urgency_marker`,
  `positive_marker`, `competitor_mention`.

Regra para decidir se um termo e generico:

```text
Se aparece em pelo menos 3 verticais sem mudar o significado, pode ficar no generic.
Caso contrario, fica no segmento.
```

Proibido:

- termos exclusivos de pneus;
- medidas de pneus;
- marcas de pneus;
- `segments/tires`.

## Papel de `scenarios.json`

`scenarios.json` e fixture/documentacao do segmento. Ele serve para testes,
auditoria humana e exemplos. O motor nao deve usar `scenarios.json` para inferencia.
Por isso ele nao entra no `ruleset_hash`.

## Saida esperada

Hints:

```text
analytics.linguistic_hints
```

Facts:

```text
analytics.conversation_facts
```

Classificacoes ficam para F2A-03.

## Testes obrigatorios

- loader valida `locale`;
- loader rejeita ruleset sem `extractor_version`;
- loader calcula `ruleset_hash`;
- loader calcula hash por bytes brutos de `rules.json`, newline e `lexicon.json`;
- routing escolhe segmento por `environment + chatwoot_account_id`;
- routing usa `chatwoot_inbox_id` quando informado;
- routing usa `defaultSegment` quando nao ha match;
- engine aplica regra generica;
- `_template` carrega sem regra real;
- trocar ruleset muda resultado sem mexer no motor;
- repositories escrevem somente em `analytics.*`;
- hints usam constraint de idempotencia.
- hints e facts carregam `ruleset_hash`.
- `scenarios.json` nao e usado pelo engine.

---

## Entrega F2A-02

### Arquivos alterados
- `db/migrations/0010_analytics_ruleset_auditability.sql` (criado)
- `src/enrichment/rules.types.ts` (criado)
- `src/enrichment/rules.loader.ts` (criado)
- `src/enrichment/rules.engine.ts` (criado)
- `src/enrichment/hints.repository.ts` (criado)
- `src/enrichment/facts.repository.ts` (criado)
- `src/enrichment/index.ts` (modificado — exports dos novos modulos)
- `segments/routing.json` (criado)
- `segments/generic/rules.json` (criado)
- `segments/generic/lexicon.json` (criado)
- `segments/generic/scenarios.json` (criado)
- `segments/generic/README.md` (criado)
- `segments/_template/rules.json` (criado)
- `segments/_template/lexicon.json` (criado)
- `segments/_template/scenarios.json` (criado)
- `segments/_template/README.md` (criado)
- `tests/unit/enrichment/rules.loader.test.ts` (criado)
- `tests/unit/enrichment/rules.engine.test.ts` (criado)
- `tests/unit/enrichment/hints.repository.test.ts` (criado)
- `tests/unit/enrichment/facts.repository.test.ts` (criado)
- `docs/tasks/F2A-02-generic-rule-engine.md` (modificado — registro de entrega)

### Checklist
- [x] Migration 0010 criada: `ruleset_hash` em `analytics.linguistic_hints` e `analytics.conversation_facts`; UNIQUE `hints_dedup_key` em hints; deduplicacao preventiva de hints existentes.
- [x] `src/enrichment/rules.types.ts`: schemas Zod para routing, ruleset, lexicon, scenarios, rule types (keyword, regex, phrase_set), hint e fact outputs.
- [x] Schemas rejeitam regex invalido, regex `hint` sem `hint_type`, regex `fact` sem `fact_key` e ids duplicados de regra.
- [x] `src/enrichment/rules.loader.ts`: carrega routing, resolve segmento por `environment + account_id + inbox_id`, carrega ruleset/lexicon, calcula `ruleset_hash` por SHA-256 dos bytes brutos de `rules.json` + newline + `lexicon.json`.
- [x] Loader valida consistencia entre nome do segmento carregado, `ruleset.segment` e `lexicon.locale`.
- [x] `src/enrichment/rules.engine.ts`: aplica keyword (substring case-insensitive), regex (match com grupos), phrase_set (substring case-insensitive) sobre mensagens; retorna hints e facts com provenance completa.
- [x] `src/enrichment/hints.repository.ts`: INSERT em `analytics.linguistic_hints` com `ON CONFLICT ON CONSTRAINT hints_dedup_key DO NOTHING`.
- [x] `src/enrichment/facts.repository.ts`: INSERT em `analytics.conversation_facts` com `ON CONFLICT DO UPDATE` no UNIQUE existente.
- [x] `segments/generic/`: rules.json com regras neutras (price_complaint, urgency_marker, competitor_mention, positive_marker, abandonment_marker, price_quoted); lexicon.json com stopwords pt-BR; scenarios.json com exemplos; README.md.
- [x] `segments/_template/`: estrutura minima valida, sem regra de negocio real.
- [x] `segments/routing.json`: roteamento por environment + account_id, inbox_id opcional, fallback para defaultSegment.
- [x] Testes unitarios cobrem: loader (validacao, hash, roteamento), engine (keyword, regex, phrase_set, null content, template vazio, troca de ruleset), repositories (INSERT, idempotencia, provenance, ausencia de escrita em raw/core).
- [x] `npm run typecheck` verde.
- [x] `npm test` 170/170 verde (30 arquivos).
- [x] `npm run build` verde.

### Pendencias
- Validacao Supabase real nao executada: DATABASE_URL nao disponivel nesta sessao.
- A migration 0010 deve ser aplicada manualmente no banco antes de usar os repositories em producao.

### Auditoria Codex
- Escopo aprovado: nao criou regras de pneu, nao alterou normalizacao e manteve escrita limitada a `analytics.*`.
- Ajuste aplicado: migration 0010 ficou mais segura para reaplicacao; `hints_dedup_key` so e criada se ainda nao existir.
- Ajuste aplicado: `pattern_id` em `analytics.linguistic_hints` passa a ser obrigatorio com sentinela `unknown_pattern` para linhas antigas sem valor. Isso evita duplicata silenciosa por NULL em chave UNIQUE.
- Ajuste aplicado: `chatwoot_inbox_id` no routing e realmente opcional; `chatwoot_account_id` e `chatwoot_inbox_id` exigem inteiros positivos.
- Ajuste aplicado: ruleset rejeita regex invalido antes do runtime e impede combinacoes incompletas (`hint` sem `hint_type`, `fact` sem `fact_key`).
- Ajuste aplicado: ruleset rejeita ids duplicados de regra.
- Ajuste aplicado: loader rejeita segmento com nome ou locale divergente entre `rules.json` e `lexicon.json`.

### Riscos
- `scenarios.json` nao e carregado pelo motor em runtime (por design), mas nao ha validacao automatica de que as regras cobrem os cenarios declarados. Isso e intencional: cenarios sao fixture/documentacao.
- O hash SHA-256 e calculado a partir dos bytes brutos em disco. Se o arquivo for editado e salvo com encoding diferente (ex: BOM UTF-8), o hash mudara mesmo que o conteudo JSON seja identico. Isso e aceitavel porque reflete a realidade do arquivo em disco.
- `insertHints` e `insertFacts` usam loop serial de inserts. Para volumes muito grandes (>1000 hints por conversa), pode ser lento. Otimizacao em batch pode ser feita em task futura se necessario.

### Validacao executada
- `npm run typecheck` -> verde
- `npm test` -> 30 arquivos, 170 testes, todos passaram
- `npm run build` -> verde
- Supabase real -> nao executado (DATABASE_URL nao disponivel nesta sessao)
