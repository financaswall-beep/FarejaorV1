# 07 - Commerce e Grafo Veicular

## Ideia central

Nao usar catalogo plano como no beta.

Usar grafo comercial:

```text
vehicle_model -> vehicle_fitment -> tire_spec -> product -> stock/price/media
```

Assim o agente entende relacao.

Exemplo:

```text
Bros 160 + traseiro
        ↓
medida correta
        ↓
produtos compativeis
        ↓
estoque, preco, foto e politica
```

## Veiculo desde o dia 1

Hoje o negocio e moto.

Futuramente pode ter carro.

Por isso o schema usa:

- `commerce.vehicle_models`
- `commerce.vehicle_fitments`

Nao usar:

- `motorcycle_models`
- `motorcycle_fitments`

Campo conceitual:

```text
vehicle_type = motorcycle | car
```

Dados iniciais: apenas `motorcycle`.

## Tabelas principais

### `commerce.products`

Produto vendavel.

Exemplo:

```text
Pneu Maggion 100/80-17 traseiro
```

### `commerce.tire_specs`

Especificacao tecnica do pneu.

Campos conceituais:

- largura;
- perfil;
- aro;
- construcao;
- posicao suportada;
- indice de carga;
- indice de velocidade;
- uso.

### `commerce.vehicle_models`

Modelos de veiculo.

Exemplo:

```text
Honda Bros 160
```

### `commerce.vehicle_fitments`

Qual medida cabe em qual veiculo e posicao.

Validacao:

- `vehicle_type` fica em `vehicle_models`;
- trigger valida se a posicao e compativel com o tipo de veiculo;
- repository TypeScript tambem valida com Zod para erro melhor.

### `commerce.stock_levels`

Verdade operacional do estoque.

Sem `location_id` no v1.

### `commerce.product_prices`

Historico de precos com janela de validade.

Skill le `commerce.current_prices`, nao a tabela bruta.

Regra da view:

```text
se houver sobreposicao de preco ativo, menor preco ativo vence
```

### `commerce.store_policies`

Politicas da loja.

Chaves fechadas, nao livres.

Exemplos:

- address;
- opening_hours;
- mounting_policy;
- warranty_description;
- payment_methods;
- pickup_available.

### `commerce.geo_resolutions`

Cache supervisionado de bairro -> cidade.

### `commerce.fitment_discoveries`

Descoberta de compatibilidade ainda nao oficial.

Status:

- pending;
- approved;
- rejected;
- promoted.

Fluxo:

```text
descobriu via web
        ↓
pending
        ↓
humano aprova
        ↓
approved
        ↓
job/trigger promove para vehicle_fitments
        ↓
promoted
```

Regra:

```text
agente nao vende como certeza se a compatibilidade depender de discovery nao promoted
```

## Estoque operacional vs observabilidade

`commerce.stock_levels` e fonte de venda.

`ops.stock_snapshots` e observabilidade/historico. Nao e fonte para o agente vender.

