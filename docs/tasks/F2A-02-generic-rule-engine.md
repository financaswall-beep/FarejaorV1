# F2A-02 - Motor generico de regras declarativas

## Objetivo

Criar o motor generico de regras da Fase 2a sem regra de pneu.

Esta task prepara o projeto para ser bifurcado como base reutilizavel.

## Escopo

- Criar loader de regras declarativas.
- Criar schema Zod para validar ruleset.
- Criar `segments/generic/` com exemplos neutros.
- Aplicar regras sobre mensagens de uma conversa.
- Gerar objetos prontos para `analytics.linguistic_hints` e
  `analytics.conversation_facts`.
- Testar que trocar o ruleset muda os resultados sem alterar o motor.

## Arquivos que pode criar/alterar

- `src/enrichment/rules.loader.ts`
- `src/enrichment/rules.engine.ts`
- `src/enrichment/rules.types.ts`
- `src/enrichment/hints.repository.ts`
- `src/enrichment/facts.repository.ts`
- `segments/generic/rules.json`
- `segments/generic/README.md`
- `tests/unit/enrichment/rules.loader.test.ts`
- `tests/unit/enrichment/rules.engine.test.ts`
- `tests/unit/enrichment/hints.repository.test.ts`
- `tests/unit/enrichment/facts.repository.test.ts`
- `docs/tasks/F2A-02-generic-rule-engine.md`

Se precisar de UNIQUE para `analytics.linguistic_hints`, abrir task separada de
migration nova. Nao alterar migration antiga.

## Regras permitidas antes do fork

Permitido:

- termos genericos como "preco", "valor", "urgente", "hoje", "mais barato",
  "fechar", "comprar";
- categorias genericas como `price_complaint`, `urgency_marker`,
  `positive_marker`, `competitor_mention`.

Proibido:

- termos exclusivos de pneus;
- medidas de pneus;
- marcas de pneus;
- `segments/tires`.

## Saida esperada

Hints:

```text
analytics.linguistic_hints
```

Facts:

```text
analytics.conversation_facts
```

Classificacoes ficam para task posterior.

## Fronteira obrigatoria

Quando esta task terminar, parar e avisar:

```text
Chegamos na fronteira do fork. O nucleo generico da F2a existe e ainda nao tem
cara de pneus. Este e o ponto para criar a tag farejador-base-v1.
```

Nao implementar F2A-04/`segments/tires` no mesmo lote.

