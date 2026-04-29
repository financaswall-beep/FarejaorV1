# 05 - Fact Ledger da LLM Organizadora

## Ideia central

Interpretacao de conversa e ledger, nao estado mutavel.

Nao queremos:

```text
a conversa diz X agora, sobrescrevendo o passado
```

Queremos:

```text
na mensagem 3 inferimos X
na mensagem 7 o cliente corrigiu para Y
X foi superado por Y
```

## Onde a Organizadora LLM escreve hoje

A implementacao atual da Organizadora LLM escreve somente:

- `analytics.conversation_facts`
- `analytics.fact_evidence`
- `ops.agent_incidents` quando algo falha ou e bloqueado

Ela nao escreve em:

- `raw.*`
- `core.*`
- `commerce.*`
- `agent.*`
- `analytics.linguistic_hints`
- `analytics.conversation_classifications`

Importante:

```text
analytics.linguistic_hints e analytics.conversation_classifications existem,
mas pertencem ao enrichment deterministico da Fase 2a, nao ao worker LLM
Organizadora implementado em 2026-04-29.
```

## Evidencia obrigatoria

Toda linha LLM em `analytics.conversation_facts` precisa ter evidencia em
`analytics.fact_evidence`.

Campos principais:

```text
analytics.fact_evidence
- id
- fact_id
- from_message_id
- evidence_text
- evidence_type
- extractor_version
- created_at
```

Regra:

```text
from_message_id deve pertencer a conversa processada.
evidence_text deve ser trecho literal da mensagem referenciada.
```

Nao pode ser parafrase da LLM.

## Schema fechado

Segmento de pneus usa schema fechado:

- `segments/moto-pneus/extraction-schema.json`
- `src/shared/zod/fact-keys.ts`

Chave fora da whitelist nao entra.

## Supersedencia

A Organizadora nao faz UPDATE de valor.

Ela insere fato novo.

Codigo deterministico decide a relacao com o fato ativo anterior:

- se o novo fato for mais forte/igual, ele supersede o anterior;
- se o novo fato for mais fraco, ele tambem e inserido, mas ja nasce superseded pelo fato ativo.

Hierarquia de `truth_type`:

```text
corrected > observed > inferred > predicted
```

Quando a hierarquia for igual, `confidence_level` maior ou igual pode superseder.

Exemplo:

```text
mensagem 3: moto_modelo = Bros 160, confidence 0.97, observed
mensagem 8: moto_modelo = Honda, confidence 0.58, inferred
```

Resultado esperado:

```text
Bros 160 continua como fato atual.
Honda entra no ledger como fato fraco superseded, para auditoria.
```

## Views de verdade atual

O agente nao precisa reconstruir tudo do zero.

Views previstas/existentes:

- `analytics.current_facts`
- `analytics.current_classifications`

`analytics.current_facts` deve retornar apenas fatos sem `superseded_by`.

## Quando a Organizadora roda

Nao roda sincronamente antes da resposta ao cliente.

Fluxo atual:

```text
message_created
  -> Farejador grava raw/core
  -> enfileira ops.enrichment_jobs com debounce
  -> Organizadora processa em background
  -> escreve facts/evidence
```

A Atendente futura responde usando o que ja estiver consolidado no banco mais as
mensagens recentes. Ela nao bloqueia esperando a Organizadora terminar.
