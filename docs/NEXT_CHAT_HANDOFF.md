# Next Chat Handoff - Farejador

Atualizado: 2026-04-29.

Use este resumo para continuar em outro chat sem reler a conversa inteira.

## Onde Estamos

Estamos construindo a Atendente por camadas, mas ela ainda nao atende cliente.
O sistema atual em producao captura Chatwoot, normaliza, roda Organizadora LLM e
prepara dados/estado para uma futura Atendente em shadow.

## Ja Implementado

Base:

- Fase 1: webhook Chatwoot, `raw.*`, `core.*`, admin replay/reconcile.
- Fase 1.5: hardening de imutabilidade, idempotencia e guards.
- Fase 2a: enrichment deterministico.
- Fase 3 Organizadora: LLM em background escrevendo facts/evidence em
  `analytics.*`.
- Analytics marts v1.

Atendente:

- Sprint 1: estado reentrante com `agent.session_items`,
  `agent.session_slots`, `action_id`, versionamento e `applyAction`.
- Sprint 2: tools deterministicas:
  `buscarProduto`, `verificarEstoque`, `buscarCompatibilidade`,
  `calcularFrete`, `buscarPoliticaComercial`.
- Sprint 3: Context Builder + Planner foundation:
  `planner_decided`, `PlannerOutput`, `tool_requests` com input validado,
  `POLICY_VALUE_SCHEMAS`, `resolve_vehicle_model`.
- Sprint 4: Tool Executor + guardrails:
  `tool_executed/tool_failed`, `executeToolRequests`, `SayValidator` inicial,
  `ActionValidator` reforcado.
- Hardening pos-auditoria:
  logger estruturado, dinheiro com milhar, ids deterministicos compartilhados,
  idempotencia por turno no Planner.

## O Que Ainda Nao Existe

- Worker shadow da Atendente.
- Generator.
- Critic.
- Reflection loop.
- Envio Chatwoot pela Atendente.
- Atendimento automatico.

## Validacao Atual

Ultima validacao local conhecida:

- `npm test`: 253/253 verde.
- `npm run typecheck`: verde.
- `npm run build`: verde.

Ultimos commits enviados para `origin/main` e `pneus/main`:

- `e46cf74 feat: add tool executor guardrails`
- `79847a2 fix: harden atendente guardrails`
- `05395d8 fix: share deterministic event ids`

## Proxima Fase

Sprint 5: Worker Shadow minimalista.

Objetivo: exercitar o pipeline real sem Generator e sem enviar nada ao cliente.

Fluxo esperado:

```text
ops.atendente_jobs
  -> worker pega job
  -> buildPlannerContext
  -> planTurn
  -> recordPlannerDecision
  -> executeToolRequests
  -> recordToolExecutionResults
  -> grava auditoria/turno shadow
  -> para
```

Nao fazer ainda:

- nao chamar Generator;
- nao criar texto para cliente;
- nao enviar Chatwoot;
- nao ativar Planner LLM por default;
- nao criar pedido automatico.

## Pergunta Para Comecar O Proximo Chat

"Quero abrir a Sprint 5: implementar o Worker Shadow minimalista da Atendente,
log-only, sem Generator e sem envio Chatwoot. Antes de codar, confira o estado
do repo e proponha o menor plano seguro."
