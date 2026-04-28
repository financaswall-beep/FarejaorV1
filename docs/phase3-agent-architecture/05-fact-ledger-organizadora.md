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

## Onde a Organizadora escreve

Somente:

- `analytics.linguistic_hints`
- `analytics.conversation_facts`
- `analytics.conversation_classifications`

Ela nao escreve em:

- `raw.*`
- `core.*`
- `commerce.*`
- `agent.*`

## Evidencia obrigatoria

Toda linha LLM em `analytics.conversation_facts` precisa ter evidencia.

Tabela nova:

```text
analytics.fact_evidence
- id
- fact_id
- message_id
- evidence_text
- evidence_start
- evidence_end
- evidence_kind
- confidence_contribution
- created_at
```

Regra:

```text
evidence_text deve ser trecho literal da mensagem referenciada.
```

Nao pode ser parafrase da LLM.

## Schema fechado

Segmento de pneus tera schemas declarativos:

- `segments/tires/extraction-schema.json`
- `segments/tires/hints-schema.json`
- `segments/tires/classification-schema.json`
- `segments/tires/affirmation-lexicon.json`

Chave fora da whitelist nao entra.

## Supersedencia

A Organizadora nao faz UPDATE.

Ela insere fato novo.

Codigo deterministico decide se supersede o fato anterior.

Exemplo:

```text
mensagem 3: moto_modelo = Bros 160, confidence 0.7
mensagem 8: moto_modelo = Bros 150, truth_type confirmado_cliente
```

O codigo marca o fato antigo como superado pelo novo.

## Views de verdade atual

O agente nao precisa reconstruir tudo do zero.

Views previstas:

- `analytics.current_facts`
- `analytics.current_classifications`

Elas retornam o estado atual calculado a partir do ledger.

## Organizadora por mensagem

Roda a cada mensagem do cliente, em paralelo.

A Atendente responde a mensagem N usando:

- analytics consolidado ate N-1;
- texto bruto da mensagem N.

Depois, a Organizadora enriquece N para o proximo turno.

