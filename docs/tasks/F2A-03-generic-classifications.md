# F2A-03 - Classificacoes deterministicas genericas

## Objetivo

Gerar classificacoes genericas em `analytics.conversation_classifications` sem
usar LLM e sem regra de pneu.

Esta task ainda faz parte da base reutilizavel. Ela deve acontecer antes da tag
`farejador-base-v1`.

## Escopo

Criar classificacoes deterministicas a partir de signals, hints e facts:

- `stage_reached`;
- `buyer_intent`;
- `urgency`;
- `final_outcome`;
- `loss_reason`.

As regras devem ser genericas e reaproveitaveis em pneus, imobiliaria, material de
construcao, autopecas, clinicas e servicos locais.

Importante: classificacoes genericas tem cobertura limitada ate existir um pacote
de segmento. `loss_reason=delivery` e `loss_reason=stock` so devem ser gravados
quando houver evidencia generica clara. Se a evidencia depender de vocabulario de
pneu, imobiliaria ou outro segmento, nao gravar nesta task.

## Arquivos que pode criar/alterar

- `src/enrichment/classification.service.ts`
- `src/enrichment/classifications.repository.ts`
- `db/migrations/0012_classification_ruleset_auditability.sql`
- `tests/unit/enrichment/classification.service.test.ts`
- `tests/unit/enrichment/classifications.repository.test.ts`
- `docs/tasks/F2A-03-generic-classifications.md`

Pode alterar `src/enrichment/cli.ts` se necessario para executar classificacoes no
mesmo comando `npm run enrich`.

## Regras

- Escrever somente em `analytics.conversation_classifications`.
- Ler somente `core.*` e `analytics.*`.
- Nao escrever em `raw.*`.
- Nao escrever em `core.*`.
- Nao chamar LLM.
- Nao criar `segments/tires`.
- Nao usar termos especificos de pneus.

## Provenance

Usar:

```text
source = deterministic_classification_v1
truth_type = inferred
extractor_version = f2a_classification_v1
ruleset_hash = <sha256 ou pre_audit_v1>
```

Confidence deve refletir a forca da evidencia. Se a evidencia for fraca, nao gravar
classificacao.

## Migration obrigatoria

Numero: `0012_classification_ruleset_auditability.sql`. O numero `0011` ja foi
usado por `0011_relax_hint_type_check.sql` (auditoria pos-F2A-02 que removeu o
CHECK fechado em `analytics.linguistic_hints.hint_type` para permitir
extensibilidade por segmento).

Criar migration nova, sem alterar migrations antigas:

```text
ruleset_hash TEXT NOT NULL DEFAULT 'pre_audit_v1'
```

Aplicar em `analytics.conversation_classifications`.

Atualizar a idempotencia para considerar:

```text
(environment, conversation_id, dimension, source, extractor_version, ruleset_hash)
```

Se a classificacao vier de hints/facts gerados por ruleset, usar o mesmo
`ruleset_hash`. Se combinar varios hashes, ordenar os hashes e calcular SHA-256 da
lista unida por newline.

## Valores iniciais sugeridos

`stage_reached`:

- `new_conversation`;
- `need_identified`;
- `price_requested`;
- `quote_sent`;
- `purchase_intent`;
- `closed`.

`buyer_intent`:

- `low`;
- `medium`;
- `high`.

`urgency`:

- `low`;
- `medium`;
- `high`.

`final_outcome`:

- `unknown`;
- `won`;
- `lost`;
- `no_response`.

`loss_reason`:

- `price`;
- `delivery`;
- `stock`;
- `competitor`;
- `no_response`;
- `unknown`.

Nao gravar `unknown` se isso apenas significar falta de evidencia. Preferir nao
gravar linha.

Nota: `delivery` e `stock` sao valores genericos, mas a cobertura inicial pode ser
baixa antes dos segmentos adicionarem vocabulario proprio. Isso e esperado.

## Testes obrigatorios

- nao classifica sem evidencia;
- detecta urgencia generica;
- detecta reclamacao de preco como possivel `loss_reason=price`;
- detecta sinal de compra como `buyer_intent=high`;
- idempotencia por `(environment, conversation_id, dimension, source, extractor_version, ruleset_hash)`;
- classifications carregam `ruleset_hash`;
- SQL nao escreve em `raw.*` nem `core.*`.

---

## Entrega F2A-03

### Arquivos alterados
- `src/enrichment/classification.service.ts` (criado)
- `src/enrichment/classifications.repository.ts` (criado)
- `db/migrations/0012_classification_ruleset_auditability.sql` (criado)
- `src/enrichment/cli.ts` (modificado — adicionado rules engine e classifications ao pipeline)
- `src/enrichment/index.ts` (modificado — exports dos novos modulos)
- `tests/unit/enrichment/classification.service.test.ts` (criado)
- `tests/unit/enrichment/classifications.repository.test.ts` (criado)
- `tests/unit/enrichment/enrichment.cli.test.ts` (modificado — atualizado para novo comportamento do CLI)
- `docs/tasks/F2A-03-generic-classifications.md` (modificado — registro de entrega)

### Checklist
- [x] Migration 0012 criada: `ruleset_hash` em `analytics.conversation_classifications`; UNIQUE `classifications_dedup_key` com dedup preventivo; idempotente via `DO $$ IF NOT EXISTS ... END $$`.
- [x] `src/enrichment/classification.service.ts`: leitura de `analytics.conversation_signals`, `analytics.linguistic_hints`, `analytics.conversation_facts`; regras determinísticas para `urgency`, `buyer_intent`, `stage_reached`, `loss_reason`, `final_outcome`; `deriveRulesetHash` com herança, combinação SHA-256 ou sentinela `no_ruleset_v1`.
- [x] `src/enrichment/classifications.repository.ts`: INSERT com `ON CONFLICT ON CONSTRAINT classifications_dedup_key DO UPDATE` em `analytics.conversation_classifications`.
- [x] `src/enrichment/cli.ts`: pipeline signals -> rules engine -> classifications, cada etapa idempotente, mantendo retrocompat com `--conversation-id` e `--segment`.
- [x] Provenance: `source='deterministic_classification_v1'`, `truth_type='inferred'`, `extractor_version='f2a_classification_v1'`.
- [x] Testes unitarios cobrem: sem evidencia = sem classificacao, urgencia, loss_reason=price, buyer_intent=high, stage_reached=quote_sent/purchase_intent, final_outcome=won/lost, ruleset_hash simples/combinado/sentinela, idempotencia SQL, ausencia de INSERT em raw/core, ausencia de vocabulario de pneu.
- [x] `npm run typecheck` verde.
- [x] `npm test` 192/192 verde (32 arquivos).
- [x] `npm run build` verde.

### Pendencias
- Validacao Supabase real nao executada: DATABASE_URL nao disponivel nesta sessao.
- A migration 0012 deve ser aplicada manualmente no banco antes de usar os repositories em producao.

### Riscos
- `final_outcome=won` baseado em `positive_marker + price_quoted` tem confianca moderada (0.70). Pode gerar falsos positivos se o cliente disser "pode ser" sem efetivamente fechar. Ajuste de threshold pode ser feito em task futura com dados reais.
- `loss_reason=price` so e gerado quando `price_complaint` existe e `positive_marker` nao existe. Se o cliente reclamar de preco mas depois concordar, a loss_reason desaparece (comportamento esperado de snapshot).
- `delivery` e `stock` nao sao gerados nesta task por falta de evidencia generica clara; isso e intencional e documentado.

### Validacao executada
- `npm run typecheck` -> verde
- `npm test` -> 32 arquivos, 192 testes, todos passaram
- `npm run build` -> verde
- Supabase real -> nao executado (DATABASE_URL nao disponivel nesta sessao)
