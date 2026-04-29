# 20 - Analytics marts v1

Este documento explica a primeira camada de BI do projeto.

Ideia central:

> A Organizadora entende cada conversa. `analytics_marts.*` transforma milhares de conversas em numeros de negocio.

## Por que isso existe

Com 10 conversas, da para auditar manualmente:

```text
abre analytics.conversation_facts
le os fatos
confere evidence_text
```

Com 15 mil conversas, isso vira deposito.

Para virar inteligencia comercial, precisamos de views que agrupam:

- demanda por pneu;
- demanda por bairro;
- demanda por municipio;
- horario de pico;
- objecao de preco;
- concorrente citado;
- intencao do cliente;
- saude da Organizadora.

Essas views ficam no schema:

```text
analytics_marts.*
```

## O que foi criado no v1

Migration:

```text
db/migrations/0023_analytics_marts_v1.sql
```

Ela cria:

```text
analytics_marts.fact_value_text()
analytics_marts.conversation_fact_pivot
analytics_marts.daily_demand_by_tire
analytics_marts.daily_demand_by_neighborhood
analytics_marts.hourly_demand_by_city
analytics_marts.daily_price_objections
analytics_marts.daily_competitor_mentions
analytics_marts.daily_customer_intent
analytics_marts.organizadora_quality_daily
```

## Regra importante

`analytics_marts.*` nao e fonte operacional.

Ela apenas le dados de:

```text
core.*
analytics.*
ops.*
```

Ela nao altera:

```text
raw.*
core.*
analytics.conversation_facts
analytics.fact_evidence
ops.enrichment_jobs
```

Portanto, essa camada e segura: se uma view estiver ruim, corrigimos a view. Nao corrompe conversa, fato nem evidencia.

## Quem preenche

Ninguem preenche manualmente.

No v1 sao views SQL:

```text
conversation_facts + conversations + jobs + incidents
  -> analytics_marts.*
```

Ou seja:

- a Organizadora grava fatos;
- o sistema grava mensagens/jobs/incidentes;
- as views calculam os numeros na hora da consulta.

Depois, se ficar pesado, algumas views podem virar materialized views ou tabelas de resumo diario.

## View base: `conversation_fact_pivot`

Essa e a view mais importante.

Ela pega o formato ledger/EAV:

```text
conversation_id | fact_key       | fact_value
abc             | bairro         | Bonsucesso
abc             | medida_pneu    | 140/70-17
abc             | achou_caro     | true
```

E transforma em uma linha por conversa:

```text
conversation_id | bairro_mencionado | medida_pneu | achou_caro
abc             | Bonsucesso        | 140/70-17   | true
```

Isso deixa o BI facil.

Campos principais:

| Campo | O que mostra |
|-------|--------------|
| `conversation_id` | conversa |
| `chatwoot_conversation_id` | id da conversa no Chatwoot |
| `contact_id` | cliente |
| `started_date_local` | dia local da conversa |
| `started_hour_local` | hora local |
| `started_dow_local` | dia da semana |
| `moto_modelo` | modelo da moto |
| `medida_pneu` | medida procurada |
| `posicao_pneu` | dianteiro/traseiro/ambos |
| `bairro_mencionado` | bairro citado |
| `municipio_mencionado` | municipio citado |
| `intencao_cliente` | intencao |
| `motivo_compra` | motivo |
| `urgencia` | urgencia |
| `achou_caro` | objecao de preco |
| `preco_concorrente` | preco dito do concorrente |
| `concorrente_citado` | concorrente mencionado |
| `total_current_facts` | quantos fatos atuais a conversa tem |
| `avg_confidence_level` | media de confianca dos facts atuais |

## View: `daily_demand_by_tire`

Responde:

```text
Quais pneus sao mais procurados por dia?
Qual moto aparece mais?
Qual medida gera objecao de preco?
```

Campos:

| Campo | O que mostra |
|-------|--------------|
| `started_date_local` | dia |
| `medida_pneu` | medida |
| `posicao_pneu` | dianteiro/traseiro/ambos |
| `moto_modelo` | moto |
| `conversation_count` | quantas conversas |
| `unique_contacts` | quantos clientes unicos |
| `high_urgency_count` | quantos com urgencia alta |
| `accepted_offer_count` | quantos aceitaram oferta |
| `price_objection_count` | quantos acharam caro |

Exemplo de uso:

```sql
select *
from analytics_marts.daily_demand_by_tire
where environment = 'prod'
order by started_date_local desc, conversation_count desc
limit 50;
```

## View: `daily_demand_by_neighborhood`

Responde:

```text
Quais bairros procuram mais?
Quais municipios geram mais conversa?
Onde perguntam mais sobre entrega hoje?
```

Campos:

| Campo | O que mostra |
|-------|--------------|
| `started_date_local` | dia |
| `municipio_mencionado` | municipio |
| `bairro_mencionado` | bairro |
| `conversation_count` | conversas |
| `unique_contacts` | clientes unicos |
| `product_search_count` | conversas com busca de produto |
| `same_day_delivery_questions` | perguntas sobre entrega hoje |
| `price_objection_count` | objecoes de preco |

Exemplo:

```sql
select *
from analytics_marts.daily_demand_by_neighborhood
where environment = 'prod'
order by started_date_local desc, conversation_count desc;
```

## View: `hourly_demand_by_city`

Responde:

```text
Qual horario cada bairro/municipio chama mais?
Qual dia da semana tem mais procura?
```

Campos:

| Campo | O que mostra |
|-------|--------------|
| `started_dow_local` | dia da semana, 0=domingo |
| `started_hour_local` | hora do dia |
| `municipio_mencionado` | municipio |
| `bairro_mencionado` | bairro |
| `conversation_count` | conversas |
| `unique_contacts` | clientes unicos |
| `product_search_count` | conversas com busca de produto |

Exemplo:

```sql
select *
from analytics_marts.hourly_demand_by_city
where environment = 'prod'
order by conversation_count desc
limit 50;
```

## View: `daily_price_objections`

Responde:

```text
Onde estao reclamando de preco?
Quais medidas recebem mais pedido de desconto?
Qual preco medio citado de concorrente?
```

Campos:

| Campo | O que mostra |
|-------|--------------|
| `started_date_local` | dia |
| `municipio_mencionado` | municipio |
| `bairro_mencionado` | bairro |
| `medida_pneu` | medida |
| `achou_caro_count` | quantos acharam caro |
| `pediu_desconto_count` | quantos pediram desconto |
| `perguntou_parcelamento_count` | quantos perguntaram parcelamento |
| `competitor_price_count` | quantos citaram preco concorrente |
| `avg_competitor_price` | media do preco concorrente citado |

## View: `daily_competitor_mentions`

Responde:

```text
Quais concorrentes aparecem?
Com qual medida eles competem mais?
Qual preco medio dizem que o concorrente fez?
```

Campos:

| Campo | O que mostra |
|-------|--------------|
| `started_date_local` | dia |
| `concorrente_citado` | nome do concorrente ou "(concorrente_nao_nomeado)" |
| `medida_pneu` | medida |
| `mention_count` | quantidade de mencoes |
| `unique_contacts` | clientes unicos |
| `avg_competitor_price` | preco medio citado |

## View: `daily_customer_intent`

Responde:

```text
Por que o cliente chamou?
Qual urgencia aparece mais?
Quanto vira aceite/oferta?
Quantos pedem humano?
```

Campos:

| Campo | O que mostra |
|-------|--------------|
| `started_date_local` | dia |
| `intencao_cliente` | comprar, consultar preco, estoque etc |
| `motivo_compra` | furou, careca, viagem, trabalho etc |
| `urgencia` | alta/media/baixa |
| `conversation_count` | conversas |
| `unique_contacts` | clientes unicos |
| `accepted_offer_count` | ofertas aceitas |
| `asked_human_count` | pedidos de humano |

## View: `organizadora_quality_daily`

Essa e a primeira tela para auditar se a Organizadora esta saudavel.

Responde:

```text
Quantos jobs rodaram?
Quantos fatos foram criados?
Quantas evidencias foram criadas?
Quantos incidentes aconteceram?
Tem schema_violation?
Tem evidence_not_literal?
Tem erro de LLM?
```

Campos:

| Campo | O que mostra |
|-------|--------------|
| `day_local` | dia |
| `job_count` | jobs criados |
| `completed_job_count` | jobs concluidos |
| `failed_job_count` | jobs falhos |
| `conversations_enqueued` | conversas enfileiradas |
| `facts_created` | fatos criados |
| `evidences_created` | evidencias criadas |
| `incident_count` | incidentes |
| `schema_violation_count` | falhas de schema |
| `evidence_not_literal_count` | evidencia rejeitada por nao ser literal |
| `llm_error_count` | timeout/erro da LLM |

Exemplo:

```sql
select *
from analytics_marts.organizadora_quality_daily
where environment = 'prod'
order by day_local desc;
```

## O que ainda nao e

No v1 isso ainda nao e dashboard.

Tambem ainda nao e materialized view.

E uma camada inicial de leitura no banco.

Proximo passo depois de validar:

1. usar no Supabase SQL Editor durante o Shadow Assistido;
2. descobrir quais perguntas aparecem todo dia;
3. transformar as views mais usadas em dashboard;
4. se ficar pesado, transformar em materialized views com refresh diario.

## Como expandir depois

Novas perguntas viram novas views.

Exemplos futuros:

```text
analytics_marts.lost_demand_by_stock
analytics_marts.demand_without_catalog_match
analytics_marts.customer_return_by_neighborhood
analytics_marts.payment_preference_by_region
analytics_marts.delivery_pressure_by_hour
analytics_marts.product_gap_daily
```

Regra:

- se a pergunta depende de algo que a Organizadora ja extrai, cria view;
- se falta dado, adiciona nova `fact_key`;
- se a query ficar pesada, materializa;
- se virou decisao diaria, poe no dashboard.

## Resumo

```text
Organizadora = entende cada conversa.
analytics_marts = organiza milhares de conversas em numeros.
Dashboard futuro = mostra esses numeros para decisao.
```

Essa camada e o primeiro passo para o "rei dos dados" sem baguncar o sistema operacional.
