# F2A-05 - Pacote de segmento pneus

## Objetivo

Criar o pacote de segmento de pneus depois da tag/base `farejador-base-v1`.

Esta task nao deve comecar antes da F2A-04 e da aprovacao explicita do Wallace.

## Escopo futuro

Criar:

```text
segments/tires/
  rules.json
  lexicon.json
  scenarios.json
  README.md
```

E atualizar `segments/routing.json` para apontar a conta real para `tires`, se
Wallace aprovar.

## Exemplos de vocabulario permitido aqui

- medidas: `100/80-18`, `90/90-18`, `110/90-17`;
- aro;
- marca de pneu;
- montagem;
- balanceamento;
- camara;
- Maggion, Pirelli, Michelin, Levorin, Rinaldi;
- pneu de moto.

## Regra

Nada dessa lista pode aparecer hardcoded em `src/enrichment/*`.

