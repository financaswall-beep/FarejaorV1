# Cenarios sinteticos - venda de pneus

Atualizado: 25/04/2026

## Objetivo

Este documento define conversas artificiais para testar o Farejador no contexto real
da venda de pneus.

Importante: estes cenarios **nao mudam o escopo da Fase 1**. Na Fase 1, o sistema
apenas captura, audita e normaliza eventos em `raw.*` e `core.*`. Classificacoes como
`venda_concretizada`, `perda_por_preco` ou `abandono` pertencem a fases futuras em
`analytics.*`.

## Como usar

Os cenarios servem para:

- testar se contatos, conversas e mensagens sao normalizados corretamente;
- simular replay sem duplicar dados;
- simular reconcile com delivery ids deterministas;
- preparar a Fase 2a, onde sinais deterministicos serao gravados em `analytics.*`;
- treinar a leitura do funil de pneus sem depender de atendimento real.

Fixture correspondente:

```text
tests/fixtures/business/tire_sales_scenarios.json
```

## Validacao nivel 2 - Supabase real

Em 25/04/2026, estes cenarios foram inseridos no Supabase real com
`environment=test`, sem passar pelo Chatwoot e sem contaminar o dataset de producao.

Resultado final:

```text
cenarios: 10
raw_events sinteticos: 49
raw.raw_events processed: 49
raw.raw_events failed: 0
core.contacts: 10
core.conversations: 10
core.messages: 28
core.conversation_status_events: 1
```

A segunda execucao dos mesmos eventos retornou:

```text
inserted: 0
skipped_duplicate: 49
```

Isso confirmou que o bouncer `raw.delivery_seen` manteve idempotencia para os
delivery ids sinteticos.

Bug encontrado durante a validacao:

- `core.conversation_status_events` falhava no Postgres com erro de inferencia de tipo
  entre `env_t` e `text`.

Correcao aplicada:

- `src/persistence/status-events.repository.ts` passou a tipar explicitamente os
  parametros em uma CTE `input`.
- `src/persistence/assignments.repository.ts` recebeu o mesmo hardening preventivo.

## Funil inicial de pneus

Para estudos e futuras regras deterministicas, o funil pode ser lido em quatro eixos:

- `stage_reached`: ate onde o cliente chegou.
- `final_outcome`: resultado final observado.
- `loss_reason`: motivo de perda quando houver.
- `commercial_signals`: sinais objetivos extraidos da conversa.

Esses campos sao **interpretativos**. Portanto, quando forem implementados, devem ir
para `analytics.*`, nunca para `core.*`.

## Cenarios essenciais

### 1. Venda concretizada - compra simples

Cliente pede pneu por medida, recebe preco, confirma e pede pagamento.

Sinais esperados:

- medida informada;
- preco informado;
- cliente confirma compra;
- conversa resolvida.

Classificacao futura esperada:

```text
stage_reached: pagamento
final_outcome: venda_concretizada
loss_reason: null
```

### 2. Venda concretizada - parcelamento

Cliente pergunta se parcela, aceita a condicao e fecha.

Sinais esperados:

- pergunta sobre parcelamento;
- condicao comercial aceita;
- confirmacao de compra.

Classificacao futura esperada:

```text
stage_reached: pagamento
final_outcome: venda_concretizada
loss_reason: null
```

### 3. Perda por preco

Cliente considera caro, compara com concorrente e encerra sem comprar.

Sinais esperados:

- objecao de preco;
- mencao a concorrente;
- sem confirmacao de compra.

Classificacao futura esperada:

```text
stage_reached: orcamento
final_outcome: venda_perdida
loss_reason: preco
```

### 4. Perda por falta de estoque

Cliente pede uma medida especifica e a loja nao tem estoque.

Sinais esperados:

- medida informada;
- indisponibilidade de estoque;
- cliente nao aceita alternativa.

Classificacao futura esperada:

```text
stage_reached: disponibilidade
final_outcome: venda_perdida
loss_reason: falta_estoque
```

### 5. Perda por prazo ou entrega

Cliente precisa para o mesmo dia, mas a loja so consegue entregar/montar depois.

Sinais esperados:

- urgencia;
- prazo nao atende;
- cliente desiste.

Classificacao futura esperada:

```text
stage_reached: disponibilidade
final_outcome: venda_perdida
loss_reason: prazo
```

### 6. Abandono apos orcamento

Cliente recebe preco e nao responde mais.

Sinais esperados:

- orcamento enviado;
- sem resposta posterior do cliente;
- conversa permanece aberta ou e resolvida manualmente.

Classificacao futura esperada:

```text
stage_reached: orcamento
final_outcome: abandono
loss_reason: sem_resposta
```

### 7. Abandono de carrinho informal

Cliente escolhe pneu, informa que vai buscar/pagar, mas desaparece antes da conclusao.

Sinais esperados:

- intencao forte de compra;
- combinacao parcial;
- ausencia de pagamento/agendamento final.

Classificacao futura esperada:

```text
stage_reached: fechamento
final_outcome: abandono
loss_reason: abandono_carrinho
```

### 8. Cliente indeciso entre marcas

Cliente compara marcas, pede recomendacao, mas nao decide.

Sinais esperados:

- comparacao de marcas;
- pedido de recomendacao;
- ausencia de decisao final.

Classificacao futura esperada:

```text
stage_reached: consultoria
final_outcome: em_aberto
loss_reason: indecisao
```

### 9. Agendamento de montagem

Cliente ja aceita preco e agenda montagem.

Sinais esperados:

- horario ou dia combinado;
- servico de montagem/alinhamento mencionado;
- venda praticamente fechada.

Classificacao futura esperada:

```text
stage_reached: agendamento
final_outcome: venda_concretizada
loss_reason: null
```

### 10. Pos-venda ou garantia

Cliente volta apos a compra com reclamacao ou duvida.

Sinais esperados:

- nao e lead novo;
- mencao a compra anterior;
- pedido de garantia, troca ou suporte.

Classificacao futura esperada:

```text
stage_reached: pos_venda
final_outcome: atendimento_pos_venda
loss_reason: null
```

## Cuidados

- Usar apenas dados ficticios.
- Nao misturar estes cenarios artificiais com dados de producao sem marcar origem.
- Se forem inseridos no Supabase real, usar delivery ids e identificadores sinteticos
  claramente marcados.
- Nao gravar classificacao comercial em `core.*`.
- Antes de qualquer LLM, implementar primeiro sinais deterministicos na Fase 2a.

## Proxima fase relacionada

Com a Fase 1 tecnica fechada, estes cenarios viram base para a **Fase 2a -
enrichment deterministico**, onde regras simples podem detectar sinais como:

- medida do pneu;
- marca citada;
- preco informado;
- pedido de parcelamento;
- mencao a concorrente;
- objecao de preco;
- urgencia/prazo;
- confirmacao de compra;
- abandono por falta de resposta.
