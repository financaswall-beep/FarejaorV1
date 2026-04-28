# Fase 3 - Arquitetura do Agente de Pneus

Status: rascunho de arquitetura. Nao implementar SQL nem codigo antes de revisar estes documentos.

Esta pasta organiza a conversa sobre a Fase 3 do `farejador-pneus`.

Objetivo: desenhar a arquitetura do agente antes de codar, mantendo a separacao:

- Farejador captura e normaliza.
- LLM Organizadora entende a conversa.
- LLM Atendente conversa com o cliente.
- `commerce.*` informa catalogo, preco, estoque e politicas.
- `agent.*` guarda o estado operacional do atendimento.

## Indice

1. [Visao geral](01-visao-geral.md)
2. [Principios operacionais](02-principios-operacionais.md)
3. [Mapa de dados que queremos capturar](03-mapa-de-dados.md)
4. [Blocos do banco](04-blocos-do-banco.md)
5. [Fact ledger da LLM Organizadora](05-fact-ledger-organizadora.md)
6. [Estado da LLM Atendente](06-agent-state-atendente.md)
7. [Commerce e grafo veicular](07-commerce-grafo-veicular.md)
8. [Business intelligence - rei dos dados](08-business-intelligence-data-king.md)
9. [Skills, router e validadores](09-skills-router-e-validadores.md)
10. [Plano de fases](10-plano-de-fases.md)
11. [Perguntas abertas](11-perguntas-abertas.md)
12. [Context Builder e slot filling](12-context-builder-e-slot-filling.md)
13. [Fluxo de eventos e integracao](13-fluxo-de-eventos-e-integracao.md)
14. [Topologia de execucao](14-topologia-de-execucao.md)
15. [Shadow assistido por 5 semanas](15-shadow-assisted-mode.md)
16. [Planejamento das tabelas em portugues](16-planejamento-tabelas-em-portugues.md)
17. [Mapa portugues -> ingles tecnico](17-mapa-portugues-ingles.md)
18. [Diagrama ER (relacionamentos)](18-diagrama-er.md)

## Apoio em outras pastas

- `docs/adr/ADR-004-fase-3-arquitetura-agente.md` - decisoes registradas
- `docs/DATA_DICTIONARY.md` - secao Fase 3 atualizada (em portugues simples)
- `segments/moto-pneus/extraction-schema.json` - whitelist de fact_keys da Organizadora
- `docs/CHECKLIST.md` - secao 7 com etapas A ate F

## Regra de leitura

Estes documentos sao o blueprint. Eles devem ser revisados antes de criar migrations.

Depois da aprovacao:

1. transformar em docs oficiais da Fase 3;
2. criar migrations SQL;
3. atualizar `docs/DATA_DICTIONARY.md` em portugues simples;
4. so entao implementar TypeScript.

## Decisao de rollout

Antes de ligar a LLM Atendente, o projeto tera um periodo de **Shadow Assistido**:

- Wallace atende manualmente por aproximadamente 5 semanas;
- Farejador continua capturando `raw.*` e `core.*`;
- LLM Organizadora processa as conversas e popula `analytics.*`;
- LLM Atendente fica desligada por feature flag;
- os dados reais calibram skills, prompts, fact_keys, estoque e dashboards.

Com cerca de 100 conversas novas por dia, esse periodo deve gerar aproximadamente 3.500 conversas reais para calibracao.
