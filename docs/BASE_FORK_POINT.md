# Ponto de bifurcacao do Farejador Base

Atualizado: 25/04/2026

## Objetivo

Este documento define quando o Farejador pode ser salvo como **projeto base** para
ser reaproveitado em outros segmentos, como:

- pneus;
- imobiliaria;
- material de construcao;
- autopecas;
- clinicas;
- servicos locais.

## Veredito curto

Nao bifurcar agora.

O melhor ponto para bifurcar e depois de:

1. Fase 1 fechada operacionalmente.
2. Esqueleto generico da Fase 2a criado.
3. Regras especificas de pneus isoladas em pacote/configuracao de segmento.

Nome sugerido para a tag/base:

```text
farejador-base-v1
```

## O que precisa estar pronto antes de bifurcar

### Obrigatorio

- [ ] Fase 1 fechada operacionalmente.
- [ ] Replay real testado sem duplicar `core.*`.
- [ ] Reconcile real testado em janela pequena.
- [ ] Dois workers concorrentes validados com Postgres real.
- [ ] Shadow mode real rodado por periodo combinado sem fila travada.
- [ ] Secrets rotacionados antes de producao plena.
- [ ] Documentacao de deploy atualizada.
- [ ] Checklist e handoff atualizados.

### Esqueleto minimo da Fase 2a

- [ ] Worker generico de enrichment deterministico.
- [ ] Estrutura de regras declarativas por segmento.
- [ ] Escrita somente em `analytics.*`.
- [ ] Nenhuma regra de pneu hardcoded no nucleo.
- [ ] Teste provando que um segmento pode ser trocado sem mexer em `raw.*` ou `core.*`.

## O que deve ficar no nucleo base

O nucleo base deve ser reutilizavel para qualquer negocio que use Chatwoot.

Fica no base:

- ingestion de webhook;
- validacao HMAC;
- dedup por delivery id;
- persistencia em `raw.raw_events`;
- worker de normalizacao;
- tabelas `core.contacts`, `core.conversations`, `core.messages`;
- attachments;
- status events;
- assignments;
- replay;
- reconcile;
- healthcheck;
- motor generico de sinais da Fase 2a;
- contratos de origem, auditoria e idempotencia.

## O que nao deve ficar hardcoded no nucleo

Nao colocar direto no codigo base:

- regra especifica de pneu;
- lista de marcas de pneu;
- medidas de pneu como unica gramatica aceita;
- funil exclusivo de pneus;
- motivos de perda exclusivos de pneus;
- relatorios especificos de pneus;
- termos como "frete de pneu", "montagem", "alinhamento" dentro do motor generico.

Essas coisas devem ir para um pacote de segmento.

## Estrutura sugerida para segmentos

Quando a Fase 2a comecar, usar algo nesta linha:

```text
segments/
  tires/
    rules.json
    lexicon.json
    scenarios.json
    README.md

  real-estate/
    rules.json
    lexicon.json
    scenarios.json
    README.md

  construction-materials/
    rules.json
    lexicon.json
    scenarios.json
    README.md
```

O codigo base le esses arquivos e aplica regras. O segmento muda o vocabulario e o
funil, nao a arquitetura.

## Exemplo de separacao

### Base generica

```text
Cliente perguntou produto?
Atendente informou preco?
Cliente mostrou intencao de compra?
Cliente abandonou apos orcamento?
Cliente reclamou de preco?
```

### Segmento pneus

```text
Produto = pneu 100/80-18
Marca = Pirelli / Goodyear / Maggion
Servico = montagem / alinhamento / balanceamento
Motivo de perda = falta de estoque / preco / prazo / frete
```

### Segmento imobiliaria

```text
Produto = casa / apartamento / terreno
Sinal = bairro / valor / financiamento / visita
Motivo de perda = preco / localizacao / documentacao / financiamento recusado
```

### Segmento material de construcao

```text
Produto = cimento / areia / bloco / tinta
Sinal = quantidade / entrega / obra / urgencia
Motivo de perda = frete / prazo / estoque / preco
```

## Quando criar a tag `farejador-base-v1`

Criar a tag quando estes comandos estiverem verdes:

```text
npm run typecheck
npm test
npm run build
```

E quando estes testes operacionais estiverem documentados:

```text
Chatwoot real -> webhook -> raw -> core
Replay real sem duplicacao
Reconcile real em janela pequena
Worker concorrente com Postgres real
Shadow mode sem fila travada
```

Comando sugerido:

```text
git tag farejador-base-v1
git push origin farejador-base-v1
```

## Aviso para o Codex

Quando o usuario perguntar se ja pode bifurcar, responder:

```text
Ainda nao, se algum item obrigatorio deste documento estiver pendente.
Sim, se Fase 1 estiver fechada operacionalmente e a Fase 2a generica estiver criada
sem regras de segmento hardcoded no nucleo.
```

## Proxima decisao

Antes de bifurcar, decidir se o primeiro pacote de segmento sera:

```text
segments/tires
```

ou se pneus ficara apenas como exemplo de referencia enquanto o base e estabilizado.
