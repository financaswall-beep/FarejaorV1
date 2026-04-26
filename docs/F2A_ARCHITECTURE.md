# Arquitetura F2a - Enrichment deterministico

Atualizado: 25/04/2026

## Leitura rapida

A Fase 2a e o primeiro andar de inteligencia do Farejador. Ela nao conversa com
cliente e nao usa LLM. Ela mede, detecta e classifica sinais simples a partir das
tabelas `core.*`.

O resultado fica apenas em `analytics.*`.

## Separacao entre base e segmento

O nucleo base deve responder perguntas genericas:

- quantas mensagens teve;
- quem respondeu;
- quanto demorou;
- houve reclamacao de preco;
- houve urgencia;
- houve abandono;
- houve pedido de produto;
- houve cotacao;
- houve sinal de fechamento.

O segmento responde o vocabulario especifico:

- em pneus: medidas, marcas, montagem, balanceamento, aro, frete;
- em imobiliaria: bairro, financiamento, visita, aluguel, documentacao;
- em material de construcao: cimento, areia, bloco, entrega, obra.

Regra de ouro:

```text
src/enrichment/* = motor generico
segments/*       = vocabulario e regras do negocio
```

## Modulos propostos

### `src/enrichment/signals.service.ts`

Calcula `analytics.conversation_signals` com SQL ou queries simples.

Nao entende texto. So mede estrutura.

### `src/enrichment/rules.loader.ts`

Carrega regras de `segments/<segment>/rules.json` e valida com Zod.

### `src/enrichment/rules.engine.ts`

Aplica regras declarativas sobre mensagens.

Entrada:

- conversa;
- mensagens;
- ruleset validado.

Saida:

- hints;
- facts;
- classificacoes opcionais.

### `src/enrichment/repositories/*.repository.ts`

Escreve em `analytics.*`.

Regras:

- idempotente;
- nunca escreve em `raw.*`;
- nunca escreve em `core.*`;
- sempre inclui provenance.

### `src/enrichment/worker.ts`

Orquestra a execucao.

Na primeira entrega, pode ser uma funcao chamada por teste/admin/script. O boot
automatico pode ficar para uma entrega posterior se nao for necessario ainda.

## Schema existente que deve ser reaproveitado

### `analytics.conversation_signals`

Para metricas estruturais.

Fonte esperada:

```text
source = sql_aggregation_v1
truth_type = observed
confidence_level = 1.00
extractor_version = f2a_signals_v1
```

### `analytics.linguistic_hints`

Para pistas textuais por mensagem.

Exemplos:

- price_complaint;
- urgency_marker;
- abandonment_marker;
- positive_marker;
- competitor_mention.

Fonte esperada:

```text
source = deterministic_rules_v1
truth_type = observed
extractor_version = f2a_rules_v1
```

### `analytics.conversation_facts`

Para fatos extraidos.

Exemplos:

- product_asked;
- price_quoted;
- shipping_quoted;
- payment_method;
- tire_size, apenas no pacote de pneus.

### `analytics.conversation_classifications`

Para classificacoes derivadas.

Nao usar valor quando nao houver evidencia clara.

### `analytics.customer_journey`

Pode ficar para uma entrega posterior da F2a. Ela depende de agregacao por contato,
nao de linguagem.

## Versionamento dos extratores

Cada familia de regra deve ter versao explicita:

```text
f2a_signals_v1
f2a_rules_v1
f2a_tires_v1
f2a_classification_v1
```

Mudar regra que altera resultado = nova versao.

Nao atualizar linha antiga em place quando a semantica mudar. Inserir nova versao.

## Idempotencia

Rodar o enrichment duas vezes nao pode duplicar linhas.

Padroes:

- `conversation_signals`: upsert por `conversation_id`.
- `conversation_facts`: usar chave existente `(environment, conversation_id, fact_key, source, extractor_version)`.
- `conversation_classifications`: usar chave existente `(environment, conversation_id, dimension, source, extractor_version)`.
- `linguistic_hints`: a tabela ainda nao tem UNIQUE. Na F2A-02, adicionar migration
  nova ou repository com delete+insert por conversa e versao. Nao alterar migrations
  antigas.

## Fronteira de fork

Quando F2A-02 terminar, avisar Wallace:

```text
Chegamos na fronteira do fork. Agora o nucleo generico existe e ainda nao tem regra
de pneu. Este e o ponto para criar a tag farejador-base-v1.
```

Nao criar `segments/tires` antes desse aviso.

