# Fase 2a - Enrichment deterministico

Atualizado: 25/04/2026

## Status

Fase 2a foi iniciada. A Fase 1 tecnica esta concluida e a operacao segue em
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
- classificacoes deterministicas genericas, como etapa alcancada e possivel motivo
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

Status: concluida, auditada e publicada no commit `bc44f4c`.

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

Tambem criar um CLI minimo para validacao manual:

```text
npm run enrich -- --conversation-id=<uuid> --segment=generic
```

O CLI, nesta primeira entrega, executa apenas `conversation_signals`.

Auditoria aplicada:

- CLI usa `env.FAREJADOR_ENV` centralizado.
- CLI fecha o pool ao rodar como script.
- Se a conversa nao existir no ambiente selecionado, o CLI falha explicitamente em vez de registrar falso sucesso.
- Validacao final: `npm run typecheck`, `npm test` 192/192 e `npm run build`.

### F2A-02 - Motor generico de regras declarativas

Status: concluida, auditada e validada no Supabase real.

Criar estrutura para regras por segmento, sem escrever regras de pneu.

Escopo:

- `segments/generic/*`;
- `segments/_template/*`;
- `segments/routing.json`;
- loader validado por Zod com `locale`;
- `ruleset_hash` por bytes brutos de `rules.json`, newline e `lexicon.json`;
- tipos de regra simples: keyword, regex, phrase_set;
- saida padronizada para `linguistic_hints` e `conversation_facts`;
- migration nova para idempotencia de `analytics.linguistic_hints`;
- teste provando que trocar o segmento troca as regras sem tocar em `raw.*`,
  `core.*` ou no motor.

Auditoria aplicada:

- routing aceita `chatwoot_inbox_id` opcional e exige ids positivos;
- schemas rejeitam regex invalido e regra incompleta antes do runtime;
- ids de regra duplicados sao rejeitados;
- loader valida consistencia de segmento e locale;
- migration 0010 evita duplicata por `pattern_id` nulo e cria `hints_dedup_key` de forma segura para reaplicacao;
- validacao final: `npm run typecheck`, `npm test` 192/192 e `npm run build`.
- Supabase real: migration 0010 aplicada; `hints_dedup_key` validada; teste de insert/duplicata em `analytics.linguistic_hints` executado em transacao com rollback.

Estrutura minima de cada segmento:

```text
segments/<segment>/
  rules.json
  lexicon.json
  scenarios.json
  README.md
```

### Auditoria pos-F2A-02 (Opus, 2026-04-25)

Pontos arquiteturais corrigidos antes de F2A-03:

- `0011_relax_hint_type_check.sql` — removido CHECK fechado em
  `analytics.linguistic_hints.hint_type` (bloqueava F2A-05 e qualquer segmento
  futuro com vocabulario proprio). Convencao: hints genericos em
  `segments/generic`; hints de segmento podem usar prefixo namespaced.
- `SIGNAL_TIMEZONE` em `env.ts` — timezone de `started_hour_local`/`dow_local`
  passou a ser parametrizado (default `America/Sao_Paulo`); SQL nao tem mais
  timezone hardcoded.
- `rules.loader.ts` — `SEGMENTS_BASE` resolvido via `import.meta.url` (com
  override `SEGMENTS_DIR`), nao mais via `process.cwd()`.

Numero da migration de F2A-03 deslocado para `0012`.

### F2A-03 - Classificacoes deterministicas genericas

Status: proxima entrega.

Gerar `analytics.conversation_classifications` a partir de sinais, fatos e hints
genericos:

- `stage_reached`;
- `buyer_intent`;
- `urgency`;
- `final_outcome` quando houver evidencia deterministica;
- `loss_reason` quando houver evidencia deterministica.

Esta entrega ainda nao pode conter regra de pneu. As dimensoes acima servem para
imobiliaria, material de construcao, autopecas, clinicas e outros segmentos.

Se a regra nao tiver evidencia clara, nao inventar valor.

### F2A-04 - FRONTEIRA DO FORK

Parar aqui e avisar Wallace antes de continuar.

Este e o ponto recomendado para salvar a base do projeto:

```text
git tag farejador-base-v1
git push origin farejador-base-v1
```

A tag so deve ser criada se o checklist tecnico e operacional estiver verde. Se a
operacao ainda tiver pendencia, F2A-04 vira "codigo pronto para tag" e a tag fica
aguardando operacao.

### F2A-05 - Pacote de segmento pneus

Criar `segments/tires/*`.

Aqui sim entram termos de pneu:

- medidas: `100/80-18`, `90/90-18`, `110/90-17`;
- marcas;
- termos de montagem, frete, estoque e preco;
- cenarios comerciais de perda e fechamento.

Nada disso deve ficar no nucleo.

## Selecao de segmento

O motor deve escolher o ruleset por roteamento explicito:

```text
segments/routing.json
```

Formato inicial:

```json
{
  "defaultSegment": "generic",
  "routes": [
    {
      "environment": "prod",
      "chatwoot_account_id": 1,
      "chatwoot_inbox_id": null,
      "segment": "generic"
    }
  ]
}
```

Regras:

- roteamento por `environment + chatwoot_account_id`;
- `chatwoot_inbox_id` opcional para diferenciar inboxes dentro da mesma conta;
- se nao encontrar rota, usar `defaultSegment`;
- na F2A-05 trocar a rota da conta real para `tires`, depois da tag base;
- nao decidir segmento por texto da conversa.

## Termo generico vs termo de segmento

Regra pratica:

```text
Se o termo faz sentido em pelo menos 3 verticais sem mudar o significado, pode ficar
no generic. Caso contrario, fica no segmento.
```

Exemplos genericos:

- preco;
- entrega;
- garantia;
- instalacao;
- agendamento;
- urgencia;
- concorrente.

Exemplos de segmento:

- `100/80-18`;
- aro;
- balanceamento de roda;
- financiamento imobiliario;
- cimento CP-II.

## Fronteira do fork

Eu devo avisar o usuario quando F2A-03 terminar. Nesse ponto:

- signals genericos existem;
- motor de regras generico existe;
- classificacoes genericas existem;
- existem pelo menos dois segmentos de prova (`generic` e `_template`);
- ainda nao ha regras de pneu hardcoded;
- o projeto serve como base para imobiliaria, material de construcao, autopecas,
  clinicas etc.;
- podemos criar a tag `farejador-base-v1` quando o checklist operacional tambem
  estiver verde.

Nao implementar F2A-05 sem esse aviso.

## O que fica pendente em paralelo

Essas tarefas nao bloqueiam iniciar F2a, mas bloqueiam producao plena e a tag final
caso ainda estejam abertas:

- shadow mode por periodo combinado;
- rotacao de secrets;
- `DATABASE_CA_CERT` configurado no Coolify;
- harness de integracao com Postgres real;
- Zod permissivo nos mappers criticos;
- limpeza do caminho legado de body;
- limpeza dos stubs orfaos de teste em `environment=test`.
