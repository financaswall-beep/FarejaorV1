# 12 - Context Builder e Slot Filling

## Frase principal

Persistir o que doi perder. Interpretar depois o que da para esperar. Conversar livremente com contexto pequeno.

## Por que este documento existe

A LLM Atendente trabalha em tempo real. Ela conversa, coleta dados, propoe carrinho, pede confirmacao.

Isso levanta duas perguntas que os outros documentos nao respondem direto:

- o que precisa ir pro banco em tempo real durante a conversa;
- como a LLM Atendente recebe contexto a cada turno sem alucinar.

Este documento responde as duas.

## O que e slot

Slot e dado operacional que precisa existir pra fechar o pedido.

Se perder, o cliente teria que repetir.

## Nota v1 reentrante

O modelo abaixo foi refinado no Sprint 1 da Atendente v1. A versao atual nao
substitui `agent.cart_current`, `agent.order_drafts` ou
`agent.pending_confirmations`; ela adiciona:

- `agent.session_items`, para interesses em discussao antes de virarem carrinho;
- `agent.session_slots`, para slots com `source`, `confidence`, `stale` e
  `requires_confirmation`;
- `ConversationState` montado pelo Context Builder a partir das tabelas.

Ver [21 - Atendente v1: State Design](21-atendente-v1-state-design.md) para o
contrato atual do Sprint 1.

Slots canonicos do v1:

- nome do cliente;
- itens (medida + marca + quantidade);
- bairro/endereco de entrega;
- modalidade (entrega ou retirada);
- forma de pagamento.

## O que nao e slot

Conversa fiada nao vira coluna.

Exemplos do que **nao** persiste em tempo real:

- "bom dia", "valeu", "show";
- comentario sobre o tempo;
- humor do cliente naquele turno;
- inferencia da LLM ("acho que ele esta com pressa");
- tentativa de objecao que voltou.

Tudo isso ja esta em `core.messages`. A LLM Organizadora processa async.

## Onde cada coisa mora

```text
core.messages              toda mensagem trocada, sempre, automatico
agent.cart_current         itens do carrinho em tempo real
agent.cart_current_items   linhas dos itens
agent.order_drafts         slots de checkout em tempo real
agent.session_events       o que o agente decidiu (auditoria)
agent.session_current      status da sessao (ativa/pausada/escalada)
analytics.conversation_facts  interpretacao async (Organizadora)
analytics.conversation_classifications  desfecho/motivo/segmento por dimension (Organizadora)
analytics.customer_journey  perfil agregado por contato
analytics.linguistic_hints  sinais regex/heuristica (sem LLM)
commerce.orders            so quando confirmado e promovido
```

## Por que draft fica em agent.*, nao em commerce.*

`commerce.*` e verdade comercial. Vai pra fiscal, relatorio de venda, contabil.

`agent.*` e estado vivo do agente. Pode mudar 5 vezes na mesma conversa.

Misturar os dois polui auditoria e quebra a separacao de schemas.

Regra:

```text
agent.*     vivo, mutavel, rascunho, intencao
commerce.*  fato consumado, venda confirmada
```

Pedido so nasce em `commerce.orders` quando humano ou transacao segura confirma.

## Carrinho separado de checkout

Carrinho e o que o cliente quer.

Checkout e como vai receber e pagar.

Separar evita confusao:

- `agent.cart_current` muda toda hora (cliente troca pneu, troca quantidade);
- `agent.order_drafts` e mais estavel (endereco e um, pagamento e um).

Mesmo pedido, dois objetos diferentes.

## Context Builder

Funcao TypeScript que roda **antes** de chamar a LLM Atendente, a cada turno.

Monta um pacote pequeno com o estado reconstruido do banco.

### Pipeline

```text
1. ultimas N mensagens da conversa atual
2. cart_current + cart_current_items (itens vivos)
3. order_drafts (slots de checkout vivos)
4. facts confiaveis da Organizadora (analytics.conversation_facts)
5. classificacoes ativas (analytics.conversation_classifications por dimension + analytics.customer_journey)
6. resumo do contato derivado on-demand de facts + classifications + customer_journey
7. dados da skill ativa (ex: produtos encontrados pela busca)
8. pending_confirmations abertas
```

**Importante sobre o item 6:** o resumo do contato (ex: "cliente recorrente, comprou CG 160 ano passado, sensivel a preco") nao e tabela. E uma string montada **on-demand** pelo Context Builder a partir de `analytics.conversation_facts` + `analytics.conversation_classifications` (por dimension) + `analytics.customer_journey`. Sem tabela fantasma, sem desincronizacao.

### Estrutura do prompt

```text
ESTADO DO PEDIDO AGORA
  nome: Fulano
  itens: [Pirelli 140-70-17 x1]
  endereco: (nao coletado)
  pagamento: (nao coletado)

ULTIMAS MENSAGENS
  cliente: "quero o pneu 140-70-17"
  agente: "temos em estoque, R$ 180"
  cliente: "pode ser"

CONTEXTO DO CLIENTE (derivado on-demand)
  resumo: "cliente recorrente, comprou CG 160 ano passado, sensivel a preco"

PRODUTOS DISPONIVEIS (skill ativa)
  Pirelli 140-70-17 - R$ 180 - estoque: 3
```

### Regra de ouro do Context Builder

Banco rico por dentro, contexto pequeno por turno.

A LLM nao precisa lembrar. Ela le o estado reconstruido.

## Quem grava - sempre via action handler

A LLM Atendente nunca toca no banco direto.

Terminologia:

- **skill** (conversacional) = comportamento escolhido pelo router (ex: `buscar_e_ofertar`, `tratar_objecao`). Define o tom da resposta. Ver doc 09.
- **action handler** (executor) = funcao TypeScript que executa uma action devolvida no `{ say, actions }` da LLM (ex: `save_slot`, `correct_fact`, `confirm_cart_item`). Grava no banco.

Fluxo:

```text
LLM decide: "coletei nome = Fulano"
  -> retorna action: { type: "save_slot", key: "nome", value: "Fulano" }
Action validator: schema, permissoes, pre-condicoes
Action handler executa: save_slot(session_id, "nome", "Fulano")
  -> UPDATE agent.order_drafts
```

Action handler e funcao TypeScript no repositorio. Nao e dado. Nao mora no banco.

## Anti-padroes

Nao fazer:

- gravar interpretacao em tempo real (vira `analytics.*` async);
- virar small talk em coluna (`bom dia` nao e slot);
- LLM Atendente escrever direto no banco (sempre via action handler);
- regex/`if` pra detectar modelo de moto (LLM extrai com evidence);
- guardar resumo textual gerado pela LLM como verdade operacional (resumo e derivado de facts/classifications, nao e slot);
- inventar tabela `conversation_hints` para resumo de contato (resumo e on-demand, nao persiste em tabela propria).

## Resumo executivo

```text
mensagens brutas    -> core.messages, automatico, sempre
slots do pedido     -> agent.cart_current + agent.order_drafts, tempo real, via action handler
estado da sessao    -> agent.session_current, tempo real, via action handler
auditoria           -> agent.session_events, tempo real, append-only
interpretacao       -> analytics.*, async, Organizadora
venda real          -> commerce.orders, so quando confirmado
```

Tres velocidades:

- tempo real estrutural (Farejador grava sozinho);
- tempo real operacional (Atendente via action handler grava slots);
- async interpretativo (Organizadora processa depois).
