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
