# Handoff - Farejador

Atualizado: 2026-04-29.

Este arquivo e o handoff operacional curto. Para contexto completo da proxima
conversa, use tambem `docs/NEXT_CHAT_HANDOFF.md`.

## Estado Atual

O sistema esta em Fase 3, com a Organizadora em producao e a Atendente sendo
construida por camadas, ainda sem responder clientes.

Implementado:

- Fase 1: webhook, raw, core, admin replay/reconcile.
- Fase 1.5: imutabilidade, constraints e guards.
- Fase 2a: enrichment deterministico.
- Fase 3 Organizadora: worker LLM, facts, evidence, incidentes.
- Analytics marts v1.
- Atendente Sprint 1: estado reentrante (`session_items`, `session_slots`,
  `action_id`, versionamento).
- Atendente Sprint 2: tools deterministicas de commerce.
- Atendente Sprint 3: Context Builder, Planner schema/service, policy schemas.
- Atendente Sprint 4: Tool Executor, eventos `tool_executed/tool_failed`,
  `SayValidator` inicial e `ActionValidator` reforcado.

Nao implementado/nao ligado:

- Worker shadow da Atendente.
- Generator.
- Critic.
- Envio Chatwoot pela Atendente.
- Qualquer atendimento automatico ao cliente.

## Ultimas Validacoes

- `npm test`: 253/253 verde.
- `npm run typecheck`: verde.
- `npm run build`: verde.
- Migrations ate `0026` validadas/aplicadas no Supabase atual.

## Ultimos Commits Relevantes

- `e46cf74 feat: add tool executor guardrails`
- `79847a2 fix: harden atendente guardrails`
- `05395d8 fix: share deterministic event ids`

Remotes sincronizados:

- `origin/main`
- `pneus/main`

## Proxima Fase Recomendada

Sprint 5: Worker Shadow minimalista da Atendente.

Objetivo: rodar pipeline real sem enviar nada ao cliente:

```text
ops.atendente_jobs
  -> worker pega job
  -> Context Builder
  -> Planner mock/flagado
  -> Tool Executor
  -> grava agent.turns/session_events
  -> STOP, sem Generator e sem Chatwoot
```

Por que fazer assim:

- valida a costura real entre estado, planner e tools;
- nao cria risco de resposta para cliente;
- gera material de auditoria para Wallace/Opus;
- prepara o terreno para Generator no Sprint 6.

## Cuidados

- Nao limpar nem reverter arquivos que o usuario criou sem revisar.
- Scripts temporarios na raiz foram removidos; nao recriar scripts com token ou
  dados reais fora de `tmp/`.
- `.env` e `.env.codex` nunca devem ser commitados.
- Atendente deve continuar desligada ate Wallace mandar ativar explicitamente.
