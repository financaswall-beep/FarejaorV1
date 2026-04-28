# 09 - Skills, Router, Pipeline de Actions e Validadores

## Terminologia

Para evitar ambiguidade ao implementar:

- **Skill (conversacional)**: comportamento escolhido pelo router. Define como a LLM Atendente conversa naquele turno. Lista canonica abaixo (`buscar_e_ofertar`, `tratar_objecao`, etc).
- **Action**: item estruturado retornado pela LLM no array `actions` do output `{ say, actions }`. Ex: `save_slot`, `correct_fact`, `confirm_cart_item`, `escalate_to_human`.
- **Action handler**: funcao TypeScript que executa uma action especifica. Grava no banco. Nunca chamada direto pela LLM.
- **Validator**: bloqueia execucao se algo viola contrato ou seguranca.

Skill define **conversa**.
Action define **efeito**.
Action handler **executa**.
Validator **freia**.

## Pipeline canonico

Toda resposta da Atendente passa por este pipeline:

```text
LLM Atendente
  ↓
{ say, actions }
  ↓
Say Validator   (audita o texto livre)
  ↓
Action Validator   (audita cada action)
  ↓
Action Handlers   (executam, gravam agent.*, postam Chatwoot)
  ↓
agent.turns + agent.session_events (auditoria)
```

Se Say Validator bloqueia: registra incidente, devolve fallback educado.

Se Action Validator bloqueia uma action: registra incidente, demais actions seguem se forem independentes.

Action handler nunca executa sem passar pelos dois validators.

## Skill set inicial

1. `confirmar_necessidade`
2. `responder_politica`
3. `buscar_e_ofertar`
4. `calcular_entrega`
5. `tratar_objecao`
6. `pedir_confirmacao`
7. `fechar_pedido`
8. `escalar_humano`
9. `responder_geral`

## Router deterministico

Router fica em TypeScript.

JSON fica para:

- lexicons;
- schemas;
- listas declarativas;
- patterns simples.

Motivo:

```text
logica condicional em JSON vira DSL ruim
```

## Prioridade da mensagem atual

Mensagem atual pode sobrescrever estagio.

Pseudo-fluxo:

```text
se pediu humano -> escalar_humano
se perguntou entrega -> calcular_entrega
se reclamou de preco -> tratar_objecao
se corrigiu dado critico -> confirmar_necessidade
se ha confirmacao pendente -> pedir_confirmacao
se tem dados suficientes -> buscar_e_ofertar
se nada encaixa -> responder_geral
```

## Skill responder_geral

Skill de salvacao.

Pode:

- responder educadamente;
- pedir esclarecimento;
- dizer que vai verificar;
- escalar quando necessario.

Nao pode:

- informar preco;
- prometer estoque;
- fechar pedido;
- inventar politica;
- criar carrinho.

Sempre grava em:

- `ops.unhandled_messages`

Objetivo:

```text
mensagens sem skill viram insumo para criar skill nova
```

## Validadores

Dois grupos com responsabilidades distintas. **Nao misturar.**

### Say Validator (audita o texto livre)

Roda sobre o campo `say`. Bloqueia se a LLM disse algo sem fonte.

- Preco: se `say` menciona valor monetario, a skill precisa ter retornado preco;
- Estoque: se `say` diz que tem em estoque, a skill precisa ter retornado disponibilidade;
- Promessa de prazo: se `say` promete entrega hoje/amanha, a skill `calcular_entrega` precisa ter retornado prazo;
- Fitment descoberto: discovery `pending` ou `approved` nao vira certeza de venda no texto.

Bloqueio aqui = mensagem nao vai pro cliente. Vira incidente + fallback.

### Action Validator (audita cada action)

Roda sobre cada item do array `actions`. Bloqueia action invalida.

- Schema: action passa em validacao Zod do contrato;
- Permissoes: tipo de action e permitido pra skill atual;
- Pre-condicoes: cart_item existe, fact_key esta na whitelist, evidence_message_id pertence a sessao;
- Pedido: no v1, `create_order` nao executa automaticamente, vira escalacao;
- Confirmacao: "sim" so confirma se existir `agent.pending_confirmations` aberto;
- Evidencia: action que afeta `analytics.*` exige evidence_message_id de mensagem do cliente.

Bloqueio aqui = action ignorada, demais actions seguem se independentes.

## Incidentes

Quando algo e bloqueado, registrar em:

- `ops.agent_incidents`

Tipos iniciais:

- validator_blocked;
- llm_timeout;
- llm_api_error;
- pending_confirmation_expired;
- transaction_rollback;
- router_no_skill_matched;
- evidence_not_literal;
- schema_violation.

