# Fase 2a - Enrichment deterministico

Atualizado: 25/04/2026

## Status

Fase 2a pode comecar. A Fase 1 tecnica esta concluida e a operacao segue em
shadow mode antes de producao plena.

Fase 2a continua sem LLM. Tudo que for criado aqui deve ser deterministicamente
explicavel, testavel e reprocessavel.

## Objetivo

Ler dados ja normalizados em `core.*` e gravar sinais derivados em `analytics.*`.

Exemplos:

- tempo de primeira resposta;
- quantidade de mensagens por conversa;
- pistas textuais de urgencia, preco, abandono e concorrente;
- fatos observados, como produto pedido, preco cotado e cidade mencionada;
- classificacoes deterministicas basicas, como etapa alcancada e possivel motivo
  de perda.

## Invariantes

- Nao chamar LLM.
- Nao escrever em `raw.*`.
- Nao escrever em `core.*`.
- Nao alterar a normalizacao da Fase 1 para "facilitar" analytics.
- Todo dado derivado deve ter `source`, `truth_type`, `confidence_level` e
  `extractor_version`.
- O enrichment deve ser reprocessavel. Rodar duas vezes nao pode duplicar resultado.
- Regras de segmento nao podem ficar hardcoded no nucleo.

## Arquitetura alvo

```text
core.contacts
core.conversations
core.messages
core.message_attachments
core.conversation_assignments
        |
        v
src/enrichment/*
        |
        v
analytics.conversation_signals
analytics.linguistic_hints
analytics.conversation_facts
analytics.conversation_classifications
analytics.customer_journey
```

## Entregas planejadas

### F2A-01 - Conversation signals genericos

Primeira entrega. Nao envolve regra de pneu.

Implementar calculo deterministico de `analytics.conversation_signals`:

- total de mensagens;
- mensagens do contato;
- mensagens do agente;
- mensagens de bot;
- quantidade de midias;
- tempo ate primeira resposta;
- maior intervalo parado;
- duracao total;
- handoff count;
- hora/dia local de inicio.

Essa entrega cria o worker/servico generico de enrichment, mas apenas para sinais
SQL/estruturais. E a melhor primeira tarefa para Kimi.

### F2A-02 - Motor generico de regras declarativas

Criar estrutura para regras por segmento, sem escrever regras de pneu ainda.

Escopo:

- `segments/generic/*` com exemplos neutros;
- loader validado por Zod;
- tipos de regra simples: keyword, regex, phrase_set;
- saida padronizada para `linguistic_hints` e `conversation_facts`;
- teste provando que trocar o segmento troca as regras sem tocar em `raw.*`,
  `core.*` ou no motor.

### F2A-03 - FRONTEIRA DO FORK

Parar aqui e avisar Wallace antes de continuar.

Este e o ponto recomendado para salvar a base do projeto:

```text
git tag farejador-base-v1
git push origin farejador-base-v1
```

So depois dessa tag devemos criar pacote de segmento de pneus.

### F2A-04 - Pacote de segmento pneus

Criar `segments/tires/*`.

Aqui sim entram termos de pneu:

- medidas: `100/80-18`, `90/90-18`, `110/90-17`;
- marcas;
- termos de montagem, frete, estoque e preco;
- cenarios comerciais de perda e fechamento.

Nada disso deve ficar no nucleo.

### F2A-05 - Classificacoes deterministicas basicas

Gerar `analytics.conversation_classifications` a partir de sinais e fatos:

- `stage_reached`;
- `buyer_intent`;
- `urgency`;
- `final_outcome` quando houver evidencia deterministica;
- `loss_reason` quando houver evidencia deterministica.

Se a regra nao tiver evidencia clara, nao inventar valor.

## Fronteira do fork

Eu devo avisar o usuario quando F2A-02 terminar. Nesse ponto:

- o nucleo generico esta pronto;
- ainda nao ha regras de pneu hardcoded;
- o projeto serve como base para imobiliaria, material de construcao, autopecas,
  clinicas etc.;
- podemos criar a tag `farejador-base-v1`.

Nao implementar F2A-04 sem esse aviso.

## O que fica pendente em paralelo

Essas tarefas nao bloqueiam iniciar F2a, mas bloqueiam producao plena:

- shadow mode por periodo combinado;
- rotacao de secrets;
- `DATABASE_CA_CERT` configurado no Coolify;
- harness de integracao com Postgres real;
- Zod permissivo nos mappers criticos;
- limpeza do caminho legado de body.

