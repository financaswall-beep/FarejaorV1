# 08 - Business Intelligence - Rei dos Dados

## Objetivo

Wallace quer entender o DNA do cliente e do negocio.

Isso exige mais do que tabelas operacionais.

Precisa:

1. chaves de extracao bem pensadas;
2. views/marts analiticos;
3. perfil consolidado de cliente e veiculo.

## Perguntas que o banco deve responder

### Geografia

- quais municipios mais procuram;
- quais bairros mais compram;
- quais bairros mais perdem venda;
- quais regioes pedem entrega e nao sao atendidas;
- ticket medio por bairro;
- conversao por municipio.

### Tempo

- horario que mais recebe mensagem;
- horario que mais vende;
- dia da semana com melhor conversao;
- tempo ate primeira resposta;
- tempo medio ate fechamento;
- horarios com mais abandono.

### Produto

- motos mais citadas;
- medidas mais pedidas;
- medidas mais vendidas;
- medidas mais perdidas por falta de estoque;
- marcas mais pedidas;
- marcas mais recusadas;
- estoque parado;
- estoque com alta demanda.

### Concorrencia

- concorrente mais citado;
- preco de concorrente mencionado;
- regioes onde concorrente aparece mais;
- produto onde concorrente ganha mais;
- motivo: preco, prazo, marca ou confianca.

### Funil

- entrada por topo, meio ou fundo;
- conversao por etapa;
- perda por etapa;
- quantas mensagens ate oferta;
- quantas mensagens ate fechamento;
- qual skill converte mais;
- qual skill cai mais em fallback.

### Cliente

- novo vs recorrente;
- possivel atacado;
- cliente por tipo de veiculo;
- cliente por bairro;
- recompra;
- lifetime value;
- propensao a voltar.

## Marts analiticos futuros

Nao precisam nascer no v1, mas devem estar previstos.

Possiveis estruturas:

- `analytics_marts.demand_by_city`
- `analytics_marts.demand_by_neighborhood`
- `analytics_marts.demand_by_tire_size`
- `analytics_marts.lost_sales_by_reason`
- `analytics_marts.competitor_mentions`
- `analytics_marts.peak_hours`
- `analytics_marts.conversion_by_stage`
- `analytics_marts.customer_vehicle_profile`
- `analytics_marts.lost_demand_without_stock`

## Perfil veicular do cliente

Problema:

```text
se moto fica so em facts por conversa, o mesmo cliente pode ser contado varias vezes
```

Solucao futura:

- view ou tabela derivada `commerce.customer_vehicles`;
- consolida veiculos por contato;
- fonte para campanhas e previsao de recompra.

## V1, V2, V3

### V1 - essencial para vender

- moto/modelo;
- medida;
- posicao;
- produto;
- estoque;
- preco;
- bairro/cidade;
- entrega/retirada;
- intencao;
- objecao de preco;
- carrinho;
- pedido assistido por humano.

### V2 - inteligencia comercial

- concorrente citado;
- preco do concorrente;
- motivo de compra;
- motivo de perda detalhado;
- marcas recusadas;
- demanda sem estoque;
- canal que converte melhor;
- horario de maior venda.

### V3 - rei dos dados

- cohort de recompra;
- perfil por bairro;
- previsao de estoque;
- campanha por moto/medida;
- cliente propenso a voltar;
- analise de pos-venda;
- oportunidades de expansao.

