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
```

Confidence deve refletir a forca da evidencia. Se a evidencia for fraca, nao gravar
classificacao.

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
- idempotencia por `(environment, conversation_id, dimension, source, extractor_version)`;
- SQL nao escreve em `raw.*` nem `core.*`.
