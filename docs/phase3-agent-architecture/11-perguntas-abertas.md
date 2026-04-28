# 11 - Perguntas Abertas

Estas decisoes nao bloqueiam o desenho do banco, mas precisam ser fechadas antes de implementar a integracao completa.

## LLM usada

Ainda nao definido.

Arquitetura deve funcionar com qualquer provider que entregue:

- chamada de texto;
- JSON estruturado;
- timeout;
- logs de custo;
- versionamento de prompt.

## Modo Shadow Assistido

Decisao registrada:

- Wallace atende manualmente por aproximadamente 5 semanas;
- LLM Organizadora roda;
- LLM Atendente fica desligada;
- os dados reais calibram a automacao futura.

Ainda decidir:

- quais relatorios revisar semanalmente;
- quais criterios liberam piloto da Atendente;
- quais conversas viram exemplos de prompt.

## PII no prompt

Decidir depois:

- mandar nome, telefone e endereco;
- anonimizar parcialmente;
- anonimizar totalmente.

Impacta custo de codigo e LGPD.

## Horario comercial

Decidir depois:

- bot responde 24/7;
- bot responde diferente fora do horario;
- bot coleta dados e promete retorno humano.

Nao muda o schema principal.

## Falha da LLM/API

Decidir depois:

- retry;
- fallback;
- escalacao;
- mensagem padrao.

Recomendacao inicial:

```text
retry curto -> fallback educado -> registrar incidente
```

## Deployment

Decidir depois:

- Atendente em container separado;
- endpoints separados;
- ou orquestracao por fila.

Preferencia arquitetural:

```text
servico separado, lendo core/analytics/commerce e escrevendo agent
```

## analytics marts

Ainda nao entram no primeiro schema operacional.

Precisam de sessao propria com Wallace:

```text
quais perguntas de negocio voce quer responder todo dia?
```

## Pedido automatico

Schema pode nascer preparado.

Execucao automatica fica desligada no v1.

## LLM Supervisora

Possibilidade futura, nao obrigatoria.

Perguntas em aberto:

- vale criar LLM Supervisora em batch?
- ela revisa todas as conversas ou apenas perdas/fallbacks?
- quais tabelas receberiam flags de qualidade?
- qual modelo barato seria suficiente?

Recomendacao atual:

```text
nao entra antes da LLM Atendente estar validada
```
