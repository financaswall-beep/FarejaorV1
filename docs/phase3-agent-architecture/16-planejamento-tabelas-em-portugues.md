# 16 - Planejamento das Tabelas em Portugues

Status: rascunho de negocio. Ainda nao e SQL.

Objetivo: desenhar tabela por tabela em portugues simples, para Wallace entender e aprovar antes de virar migration.

Depois de aprovado, cada nome sera traduzido para ingles tecnico no banco e documentado no `DATA_DICTIONARY.md`.

## Escopo deste documento

Este documento detalha principalmente as tabelas novas ou alteradas para a Fase 3 do `farejador-pneus`.

Tabelas que ja existem no Farejador base nao sao redesenhadas aqui, a menos que precisem de complemento novo.

Ja existem e continuam sendo usadas:

- `raw.raw_events`;
- `raw.delivery_seen`;
- `core.contacts`;
- `core.conversations`;
- `core.messages`;
- `core.message_attachments`;
- `core.conversation_tags`;
- `core.conversation_status_events`;
- `core.conversation_assignments`;
- `core.message_reactions`;
- `analytics.conversation_signals`;
- `analytics.linguistic_hints`;
- `analytics.conversation_facts`;
- `analytics.conversation_classifications`;
- `analytics.customer_journey`;
- `ops.erasure_log`;
- `ops.bot_events`;
- `ops.orphan_conversation_stubs`;
- `ops.stock_snapshots`.

Importante:

- `analytics.fact_evidence` e nova e aparece como Tabela 26.
- `ops.atendente_jobs` e nova e aparece como Tabela 25.
- `ops.enrichment_jobs` ja existia como conceito operacional, mas aqui recebe o desenho final da fila da Organizadora.
- `commerce.geo_resolutions` aparece neste documento com o nome de negocio `bairros e municipios`.
- `ops.stock_snapshots` nao e fonte de venda. A fonte de venda e `estoque`.

## Convencao deste documento

Para cada tabela:

- nome em portugues;
- para que serve;
- quem escreve;
- quem le;
- o que nao guarda;
- campos em portugues;
- tipos futuros no Postgres;
- exemplo real;
- decisoes aprovadas.

---

# Tabela 1 - produtos

## Para que serve

Guarda cada item vendavel da loja.

Produto aqui e o "cabecalho" do item. Ele diz o que e o item, mas nao guarda preco, estoque, foto ou compatibilidade.

## Exemplos

- Pneu Maggion Viper 100/80-17;
- Pneu Pirelli Super City 90/90-18;
- Camara de ar aro 17;
- Bico de pneu;
- Oleo;
- Acessorio;
- Servico de montagem.

## Quem escreve

No v1:

- importacao CSV/planilha;
- ajuste manual futuro.

No futuro:

- painel administrativo.

## Quem le

- skill `buscar_e_ofertar`;
- consultas de estoque;
- relatorios de produto;
- importadores;
- humano no painel futuro.

## O que nao guarda

Nao guarda:

- preco;
- estoque;
- foto;
- compatibilidade com moto/carro;
- taxa de entrega;
- pedido;
- detalhes tecnicos do pneu.

Esses dados ficam em tabelas separadas.

## Campos

### identificador_interno

Identificador unico interno do sistema.

Tipo futuro: `UUID`.

Obrigatorio: sim.

Exemplo: `7d7f2e3b-...`

### ambiente

Define se o dado pertence ao ambiente de producao ou teste.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Exemplos:

- `prod`
- `test`

### codigo_produto

Codigo curto/SKU usado para identificar o produto.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplo: `MAG-VIP-100-80-17`.

### nome_produto

Nome comercial do produto.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplo: `Pneu Maggion Viper 100/80-17`.

### tipo_produto

Tipo geral do item vendavel.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais aprovados:

- `pneu`
- `camara`
- `bico`
- `oleo`
- `acessorio`
- `servico`
- `outro`

Decisao aprovada: a tabela nasce generica para vender outros itens no futuro. Pneus sao o primeiro tipo.

### marca

Marca do produto.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo: `Maggion`.

### modelo_linha

Modelo ou linha comercial do produto.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo: `Viper`.

### descricao_curta

Descricao simples para ajudar humano e agente.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo: `Pneu urbano com bom custo-beneficio`.

### status_venda

Diz se o produto pode ser vendido.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores aprovados:

- `ativo` - pode vender normalmente;
- `inativo` - nao mostrar para venda, mas manter no cadastro;
- `fora_de_linha` - nao sera mais vendido, mas fica no historico;
- `sob_consulta` - existe, mas humano precisa confirmar antes de vender.

### observacoes_internas

Notas internas da loja.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplos:

- `baixa margem`;
- `conferir fornecedor antes de ofertar`;
- `evitar desconto`;
- `produto antigo`.

Regra aprovada:

```text
LLM Atendente nao pode citar observacoes_internas para cliente.
```

### criado_em

Quando o produto foi cadastrado.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### atualizado_em

Quando o produto foi alterado pela ultima vez.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### apagado_em

Soft delete.

Se preenchido, o produto nao aparece mais para venda, mas o historico continua.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: nao.

## Exemplo real

```text
codigo_produto: MAG-VIP-100-80-17
nome_produto: Pneu Maggion Viper 100/80-17
tipo_produto: pneu
marca: Maggion
modelo_linha: Viper
descricao_curta: Pneu urbano com bom custo-beneficio
status_venda: ativo
observacoes_internas: baixa margem
```

## Decisoes aprovadas

- A tabela `produtos` sera generica para todos os itens vendaveis.
- Pneus serao o primeiro tipo de produto usado.
- Detalhes tecnicos de pneu ficam em tabela separada.
- Preco, estoque e fotos ficam em tabelas separadas.
- `observacoes_internas` existe, mas nao pode ser falada automaticamente ao cliente.
- `status_venda` inclui `sob_consulta` para itens que precisam de confirmacao humana.

---

# Tabela 2 - especificacoes do pneu

Status: aprovada.

## Para que serve

Guarda os dados tecnicos do pneu.

A tabela `produtos` diz o nome comercial do item.

A tabela `especificacoes do pneu` diz a medida e caracteristicas tecnicas.

## Exemplo

Produto:

```text
Pneu Maggion Viper 100/80-17
```

Especificacao:

```text
largura: 100
perfil: 80
aro: 17
medida normalizada: 100/80-17
```

## Quem escreve

No v1:

- importacao CSV/planilha;
- ajuste manual futuro.

No futuro:

- painel administrativo;
- promocao de compatibilidade revisada.

## Quem le

- skill `buscar_e_ofertar`;
- busca por medida;
- compatibilidade com veiculo;
- relatorios de demanda por medida;
- analise de estoque por medida.

## O que nao guarda

Nao guarda:

- preco;
- estoque;
- foto;
- marca;
- nome comercial;
- pedido;
- moto/carro compativel diretamente.

Marca e nome ficam em `produtos`.

Compatibilidade com moto/carro fica em outra tabela.

## Campos

### identificador_interno

Identificador unico interno da especificacao.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### produto_id

Link com a tabela `produtos`.

Tipo futuro: `UUID`.

Obrigatorio: sim.

Regra:

```text
somente produto com tipo_produto = pneu deve ter especificacao de pneu
```

### largura_mm

Largura do pneu em milimetros.

Tipo futuro: `INTEGER`.

Obrigatorio: sim.

Exemplos:

- `90`
- `100`
- `140`

### perfil

Altura proporcional do pneu.

No exemplo `100/80-17`, o perfil e `80`.

Tipo futuro: `INTEGER`.

Obrigatorio: sim.

### aro_polegadas

Tamanho do aro em polegadas.

Tipo futuro: `INTEGER`.

Obrigatorio: sim.

Exemplos:

- `17`
- `18`

### medida_normalizada

Medida em formato padrao para busca.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Formato:

```text
largura/perfil-aro
```

Exemplos:

- `100/80-17`
- `140/70-17`
- `90/90-18`

### posicao_tecnica

Onde o pneu serve tecnicamente.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais para moto:

- `dianteiro`
- `traseiro`
- `ambos`
- `nao_informado`

Observacao importante:

```text
Para carro futuro, nao perguntar "dianteiro ou traseiro" como em moto.
Carro deve ser tratado por quantidade/tipo de troca no carrinho, nao por posicao de conversa.
```

No v1, o segmento padrao e moto.

### tipo_camara

Se o pneu usa camara.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores:

- `sem_camara`
- `com_camara`
- `ambos`
- `nao_informado`

### construcao

Tipo de construcao do pneu.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores:

- `diagonal`
- `radial`
- `nao_informado`

### indice_carga

Indice de carga do pneu, quando informado.

Tipo futuro: `INTEGER`.

Obrigatorio: nao.

Exemplo: `52`.

### indice_velocidade

Indice de velocidade do pneu, quando informado.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo: `P`.

### uso_recomendado

Uso principal do pneu.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais:

- `urbano`
- `misto`
- `offroad`
- `esportivo`
- `trabalho`
- `nao_informado`

### observacoes_tecnicas

Observacao tecnica para humano/agente.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
bom custo-beneficio para uso urbano
```

### criado_em

Quando a especificacao foi cadastrada.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### atualizado_em

Quando a especificacao foi alterada pela ultima vez.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

## Exemplo real

```text
produto: Pneu Maggion Viper 100/80-17
largura_mm: 100
perfil: 80
aro_polegadas: 17
medida_normalizada: 100/80-17
posicao_tecnica: traseiro
tipo_camara: sem_camara
construcao: diagonal
indice_carga: 52
indice_velocidade: P
uso_recomendado: urbano
observacoes_tecnicas: bom custo-beneficio para uso urbano
```

## Decisoes aprovadas

- Especificacao de pneu fica separada de `produtos`.
- Produto que nao e pneu nao entra nesta tabela.
- Produto do tipo `pneu` deve ter uma linha aqui.
- `medida_normalizada` sempre usa o formato `largura/perfil-aro`.
- Marca nao fica aqui; fica em `produtos`.
- Compatibilidade com moto/carro nao fica aqui; fica na tabela de compatibilidade.
- Banco fica preparado para carro no futuro, mas v1 e focado em moto.
- Se o cliente informar a medida, o agente deve buscar pela medida primeiro, sem perguntar "qual carro?".
- No v1, segmento padrao e moto.
- Para carro futuro, nao usar a mesma logica de "dianteiro/traseiro" da moto na conversa.

---

# Tabela 3 - veiculos

Status: aprovada.

## Para que serve

Guarda os modelos de veiculos que a loja reconhece.

No v1, sera usada para motos.

No futuro, pode receber carros sem refazer a estrutura.

## Exemplos

- Honda Bros 160;
- Honda CG 160;
- Yamaha Fazer 250;
- Honda Biz 125;
- Honda Civic 2018 no futuro;
- Toyota Corolla 2020 no futuro.

## Quem escreve

No v1:

- importacao CSV/planilha;
- ajuste manual futuro.

No futuro:

- painel administrativo;
- promocao de descoberta aprovada por humano.

## Quem le

- LLM Organizadora;
- Context Builder;
- skill `confirmar_necessidade`;
- skill `buscar_e_ofertar`;
- compatibilidade veiculo-pneu;
- relatorios por modelo de veiculo.

## O que nao guarda

Nao guarda:

- pneu compativel;
- medida do pneu;
- produto;
- estoque;
- preco;
- pedido.

Esses dados ficam em outras tabelas.

## Campos

### identificador_interno

Identificador unico interno do veiculo.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### ambiente

Define se o dado pertence ao ambiente de producao ou teste.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Exemplos:

- `prod`
- `test`

### tipo_veiculo

Diz se o registro e moto ou carro.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais:

- `moto`
- `carro`

Decisao aprovada:

```text
v1 usa moto; carro fica preparado para o futuro
```

### marca

Marca do veiculo.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplos:

- `Honda`
- `Yamaha`
- `Suzuki`
- `Toyota`

### modelo

Modelo principal.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplos:

- `Bros`
- `CG`
- `Fazer`
- `Biz`
- `Civic`

### versao

Versao ou complemento do modelo.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplos:

- `160`
- `Titan 160`
- `Fan 160`
- `Fazer 250`

### nome_completo

Nome pronto para leitura humana e busca.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplos:

- `Honda Bros 160`
- `Honda CG 160 Titan`
- `Yamaha Fazer 250`

### cilindrada

Cilindrada do veiculo, principalmente para motos.

Tipo futuro: `INTEGER`.

Obrigatorio: nao.

Exemplos:

- `125`
- `150`
- `160`
- `250`
- `300`

Decisao aprovada:

```text
cilindrada fica porque cliente fala naturalmente "Bros 160", "CG 150", "Fazer 250"
```

### ano_inicio

Primeiro ano daquela versao/modelo.

Tipo futuro: `INTEGER`.

Obrigatorio: nao.

Exemplo: `2015`.

### ano_fim

Ultimo ano daquela versao/modelo.

Tipo futuro: `INTEGER`.

Obrigatorio: nao.

Se ainda existe ou nao sabemos, fica vazio.

Exemplo: `2023`.

Decisao aprovada:

```text
ano_inicio e ano_fim ficam porque compatibilidade pode mudar por ano/versao
```

### apelidos

Outros nomes que o cliente pode usar.

Tipo futuro: `JSONB` ou array de texto.

Obrigatorio: nao.

Exemplos:

```text
["bros", "bros160", "nxr 160", "nxr bros"]
```

Decisao aprovada:

```text
apelidos ficam porque cliente nao fala sempre o nome correto
```

### ativo

Diz se o veiculo ainda deve ser usado em busca e compatibilidade.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

### observacoes

Notas internas.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
confirmar ano em caso de duvida
```

### criado_em

Quando o veiculo foi cadastrado.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### atualizado_em

Quando o veiculo foi alterado pela ultima vez.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### apagado_em

Soft delete.

Se preenchido, o veiculo deixa de aparecer nas buscas, mas o historico continua.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: nao.

## Exemplo real

```text
tipo_veiculo: moto
marca: Honda
modelo: Bros
versao: 160
nome_completo: Honda Bros 160
cilindrada: 160
ano_inicio: 2015
ano_fim: vazio
apelidos: ["bros", "bros160", "nxr 160", "nxr bros"]
ativo: sim
observacoes: confirmar ano em caso de duvida
```

## Decisoes aprovadas

- A tabela nasce preparada para moto e carro.
- V1 usa somente moto.
- Carro fica preparado para o futuro, mas nao ativo agora.
- `apelidos` fica.
- `cilindrada` fica.
- `ano_inicio` e `ano_fim` ficam.
- Internet pode ajudar a descobrir apelidos/modelos, mas nao vira verdade oficial direto.
- Banco oficial vem primeiro.
- Descoberta via internet deve entrar como pendente e depender de aprovacao humana.
- Se cliente falar apenas "Bros", o sistema tenta mapear; se faltar confianca, a Atendente pergunta melhor.

---

# Tabela 4 - compatibilidade veiculo-pneu

Status: aprovada.

## Para que serve

Liga veiculos com especificacoes de pneus.

Ela responde:

```text
esse pneu serve nesse veiculo?
serve em qual posicao?
e medida original, alternativa ou adaptacao?
precisa humano confirmar?
```

## Exemplo simples

```text
Honda Bros 160 + traseiro = 100/90-18
```

## Exemplo com varias medidas

Uma moto pode aceitar mais de uma medida na mesma posicao.

Exemplo conceitual:

```text
Yamaha Fazer 250 | traseiro | 130/70-17 | original | prioridade 1
Yamaha Fazer 250 | traseiro | 140/70-17 | alternativa_aprovada | prioridade 2
Yamaha Fazer 250 | traseiro | 150/70-17 | adaptacao | prioridade 3 | precisa humano
```

Decisao aprovada:

```text
nao assumir que veiculo + posicao = uma medida unica
```

## Quem escreve

No v1:

- importacao CSV/planilha;
- ajuste manual futuro.

No futuro:

- painel administrativo;
- promocao de descoberta aprovada por humano.

## Quem le

- skill `buscar_e_ofertar`;
- skill `confirmar_necessidade`;
- Context Builder;
- relatorios de demanda por veiculo;
- relatorios de demanda sem estoque;
- processo de descoberta de compatibilidade.

## O que nao guarda

Nao guarda:

- produto especifico;
- marca do pneu;
- preco;
- estoque;
- foto;
- pedido.

Ela liga veiculo com especificacao/medida. Depois o sistema procura produtos nessa medida.

## Campos

### identificador_interno

Identificador unico da compatibilidade.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### ambiente

Define se o dado pertence ao ambiente de producao ou teste.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Exemplos:

- `prod`
- `test`

### veiculo_id

Link com a tabela `veiculos`.

Tipo futuro: `UUID`.

Obrigatorio: sim.

Exemplo: `Honda Bros 160`.

### especificacao_pneu_id

Link com a tabela `especificacoes do pneu`.

Tipo futuro: `UUID`.

Obrigatorio: sim.

Exemplo: `100/90-18`.

### posicao_tecnica

Onde essa medida serve no veiculo.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores para moto no v1:

- `dianteiro`
- `traseiro`
- `ambos`
- `nao_informado`

Observacao:

```text
carro futuro nao deve reutilizar a conversa de "dianteiro/traseiro" como moto
```

### ano_inicio

Primeiro ano em que essa compatibilidade vale, se aplicavel.

Tipo futuro: `INTEGER`.

Obrigatorio: nao.

### ano_fim

Ultimo ano em que essa compatibilidade vale, se aplicavel.

Tipo futuro: `INTEGER`.

Obrigatorio: nao.

### tipo_compatibilidade

Explica como essa medida serve.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores aprovados:

- `original` - medida original/recomendada;
- `alternativa_aprovada` - alternativa aceita pela loja;
- `adaptacao` - pode funcionar, mas precisa cuidado;
- `nao_recomendada` - registrada para evitar oferta errada.

### prioridade_oferta

Ordem em que o agente deve considerar a medida.

Tipo futuro: `INTEGER`.

Obrigatorio: sim.

Exemplos:

- `1` - oferecer primeiro;
- `2` - alternativa;
- `3` - so se fizer sentido ou cliente pedir.

### precisa_confirmacao_humana

Diz se humano deve confirmar antes da Atendente vender/ofertar como certeza.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

Exemplo:

```text
150/70-17 na Fazer 250 pode exigir confirmacao humana
```

### restricao_uso

Explicacao sobre quando usar ou evitar essa medida.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
medida mais larga; confirmar com humano antes de indicar
```

### fonte

De onde veio a informacao.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais:

- `manual`
- `catalogo`
- `fabricante`
- `importacao`
- `web_aprovado`

### nivel_confianca

Quanto confiamos nessa compatibilidade.

Tipo futuro: `NUMERIC(3,2)`.

Obrigatorio: sim.

Exemplos:

- `1.00` - certeza;
- `0.80` - boa confianca;
- `0.60` - ainda exige cuidado.

### observacoes

Notas internas sobre a compatibilidade.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

### ativo

Diz se essa compatibilidade deve ser usada.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

### criado_em

Quando foi cadastrada.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### atualizado_em

Quando foi alterada pela ultima vez.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### apagado_em

Soft delete.

Se preenchido, essa compatibilidade deixa de ser usada, mas o historico continua.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: nao.

## Exemplo real

```text
veiculo: Yamaha Fazer 250
especificacao_pneu: 130/70-17
posicao_tecnica: traseiro
tipo_compatibilidade: original
prioridade_oferta: 1
precisa_confirmacao_humana: nao
fonte: catalogo
nivel_confianca: 1.00
ativo: sim
```

Exemplo de alternativa:

```text
veiculo: Yamaha Fazer 250
especificacao_pneu: 140/70-17
posicao_tecnica: traseiro
tipo_compatibilidade: alternativa_aprovada
prioridade_oferta: 2
precisa_confirmacao_humana: nao
fonte: manual
nivel_confianca: 0.90
ativo: sim
```

Exemplo de adaptacao:

```text
veiculo: Yamaha Fazer 250
especificacao_pneu: 150/70-17
posicao_tecnica: traseiro
tipo_compatibilidade: adaptacao
prioridade_oferta: 3
precisa_confirmacao_humana: sim
restricao_uso: medida mais larga; confirmar antes de indicar
fonte: manual
nivel_confianca: 0.70
ativo: sim
```

## Decisoes aprovadas

- A tabela oficial deve guardar apenas compatibilidades confiaveis/aprovadas.
- Descobertas pendentes ficam em outra tabela.
- Uma moto pode ter varias medidas para a mesma posicao.
- O agente deve oferecer primeiro a menor prioridade numerica.
- `adaptacao` nao deve ser vendida como certeza sem confirmacao humana.
- `nao_recomendada` pode existir para evitar que o agente ofereca medida errada.
- Compatibilidade liga veiculo com medida/especificacao, nao com produto/marca.
- Depois de achar a medida, o sistema procura produtos, estoque e preco.

---

# Tabela 5 - midias do produto

Status: aprovada.

## Para que serve

Guarda fotos, videos ou documentos ligados a um produto.

No v1, o uso principal e foto do produto para ajudar a venda.

## Exemplos

- foto principal do pneu;
- foto lateral;
- foto da etiqueta;
- video curto do produto, se existir no futuro.

## Quem escreve

No v1:

- upload manual;
- associacao manual de midia recebida no Chatwoot, se for util.

No futuro:

- painel administrativo.

## Quem le

- skill `buscar_e_ofertar`;
- Context Builder;
- humano no painel futuro;
- relatorios de catalogo.

## O que nao guarda

Nao guarda:

- produto em si;
- preco;
- estoque;
- compatibilidade;
- pedido.

## Campos

### identificador_interno

Identificador unico da midia.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### ambiente

Define se o dado pertence ao ambiente de producao ou teste.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Exemplos:

- `prod`
- `test`

### produto_id

Link com a tabela `produtos`.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### tipo_midia

Tipo da midia.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais:

- `foto`
- `video`
- `documento`
- `outro`

### url_midia

Link da imagem, video ou documento.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

### origem_midia

De onde veio a midia.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores aprovados:

- `upload_manual`
- `chatwoot`
- `outro`

Decisao aprovada:

```text
foto de fornecedor/fabricante nao e necessaria no v1
```

### titulo

Nome curto da midia.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplos:

- `Foto principal`
- `Foto lateral`
- `Etiqueta`

### descricao

Descricao simples da midia.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
foto lateral mostrando desenho do pneu
```

### prioridade

Ordem em que a midia deve aparecer ou ser usada.

Tipo futuro: `INTEGER`.

Obrigatorio: sim.

Exemplos:

- `1` - foto principal;
- `2` - segunda foto;
- `3` - detalhe.

### pode_enviar_cliente

Define se a Atendente pode mandar essa midia ao cliente.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

### ativo

Diz se a midia ainda deve ser usada.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

### criado_em

Quando a midia foi cadastrada.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### atualizado_em

Quando a midia foi alterada pela ultima vez.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### apagado_em

Soft delete.

Se preenchido, a midia deixa de aparecer, mas o historico continua.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: nao.

## Exemplo real

```text
produto: Pneu Maggion Viper 100/80-17
tipo_midia: foto
url_midia: https://...
origem_midia: upload_manual
titulo: Foto principal
descricao: Foto frontal do pneu
prioridade: 1
pode_enviar_cliente: sim
ativo: sim
```

## Decisoes aprovadas

- Um produto pode ter varias midias.
- No v1, pode comecar com uma foto principal por produto.
- A midia com menor prioridade aparece primeiro.
- A Atendente so pode enviar midia com `pode_enviar_cliente = sim`.
- Foto de fornecedor/fabricante nao e necessaria no v1.
- `origem_midia` fica, mas com valores simples: `upload_manual`, `chatwoot`, `outro`.
- `texto_alternativo` nao entra no v1 para manter a tabela enxuta.

---

# Tabela 6 - estoque

Status: aprovada.

## Para que serve

Guarda a quantidade disponivel e reservada de cada produto.

E uma tabela sensivel, porque a Atendente nao pode prometer produto que nao existe.

## Exemplo

```text
Produto: Pneu Maggion Viper 100/80-17
quantidade total: 5
quantidade reservada: 2
quantidade disponivel: 3
```

## Quem escreve

No v1:

- importacao CSV/planilha;
- ajuste manual;
- sistema ao reservar/liberar estoque no futuro.

No futuro:

- painel administrativo;
- integracao com ERP/PDV.

## Quem le

- skill `buscar_e_ofertar`;
- Say Validator;
- Action Validator;
- relatorios de estoque;
- relatorios de demanda sem estoque.

## O que nao guarda

Nao guarda:

- nome do produto;
- marca;
- preco;
- foto;
- pedido;
- compatibilidade.

## Campos

### identificador_interno

Identificador unico do registro de estoque.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### ambiente

Define se o dado pertence ao ambiente de producao ou teste.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Exemplos:

- `prod`
- `test`

### produto_id

Link com a tabela `produtos`.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### quantidade_total

Quantidade fisica ou informada como existente.

Tipo futuro: `INTEGER`.

Obrigatorio: sim.

Regra:

```text
nao pode ser negativa
```

### quantidade_reservada

Quantidade separada para carrinhos/pedidos confirmados.

Tipo futuro: `INTEGER`.

Obrigatorio: sim.

Regra:

```text
nao pode ser negativa e nao pode passar da quantidade_total
```

### quantidade_disponivel

Quantidade que pode ser vendida agora.

Tipo futuro: coluna calculada ou view.

Regra aprovada:

```text
quantidade_disponivel = quantidade_total - quantidade_reservada
```

Decisao:

```text
nao salvar manualmente para evitar inconsistencia
```

### status_estoque

Estado geral do estoque.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores aprovados:

- `disponivel`
- `baixo`
- `esgotado`
- `sob_consulta`

### estoque_minimo

Quantidade minima antes de considerar estoque baixo.

Tipo futuro: `INTEGER`.

Obrigatorio: sim.

Exemplo: `2`.

### origem_atualizacao

De onde veio a ultima atualizacao.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais:

- `importacao`
- `manual`
- `pedido`
- `ajuste`

### importacao_id

Link com lote de importacao, quando veio de planilha.

Tipo futuro: `UUID`.

Obrigatorio: nao.

### atualizado_por

Quem fez a alteracao, se souber.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplos:

- `wallace`
- `importador`
- `sistema`

### observacoes

Nota interna sobre o estoque.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
confirmar fisicamente antes de ofertar
```

### criado_em

Quando o registro foi criado.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### atualizado_em

Quando o registro foi alterado pela ultima vez.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

## Exemplo real

```text
produto: Pneu Maggion Viper 100/80-17
quantidade_total: 5
quantidade_reservada: 2
quantidade_disponivel: 3
status_estoque: disponivel
estoque_minimo: 2
origem_atualizacao: importacao
```

## Regras importantes

- `quantidade_total` nao pode ser negativa.
- `quantidade_reservada` nao pode ser negativa.
- `quantidade_reservada` nao pode ser maior que `quantidade_total`.
- `quantidade_disponivel` deve ser calculada.
- Atendente so pode dizer que tem estoque se `quantidade_disponivel > 0`.
- Se `status_estoque = sob_consulta`, humano precisa confirmar.
- Se `status_estoque = esgotado`, nao ofertar como disponivel.
- Se `quantidade_disponivel <= estoque_minimo`, pode tratar como estoque baixo.

## Decisoes aprovadas

- Nao colocar local/loja/deposito no v1.
- Operacao atual assume um estoque unico.
- Se no futuro houver mais de uma loja/deposito, criar `locais_estoque` ou campo equivalente.
- Estoque real da venda fica aqui, nao em `ops.stock_snapshots`.
- `ops.stock_snapshots` e observabilidade, nao fonte para vender.

---

# Tabela 7 - precos

Status: aprovada.

## Para que serve

Guarda o preco atual e o historico de precos de cada produto.

E uma tabela sensivel, porque a Atendente nao pode inventar preco.

## Exemplo

```text
Produto: Pneu Maggion Viper 100/80-17
preco a vista: R$ 180,00
preco cartao: R$ 190,00
parcelamento: 2x de R$ 95,00 sem juros
```

## Quem escreve

No v1:

- importacao CSV/planilha;
- ajuste manual.

No futuro:

- painel administrativo;
- rotina de promocao.

## Quem le

- skill `buscar_e_ofertar`;
- Say Validator;
- relatorios de venda;
- comparacao de preco ofertado vs conversao.

## O que nao guarda

Nao guarda:

- nome do produto;
- estoque;
- foto;
- pedido;
- compatibilidade;
- frete.

## Campos

### identificador_interno

Identificador unico do preco.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### ambiente

Define se o dado pertence ao ambiente de producao ou teste.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Exemplos:

- `prod`
- `test`

### produto_id

Link com a tabela `produtos`.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### preco_avista

Preco a vista.

Tipo futuro: `NUMERIC(12,2)`.

Obrigatorio: sim.

Regra:

```text
nao pode ser negativo
```

### preco_cartao

Preco no cartao.

Tipo futuro: `NUMERIC(12,2)`.

Obrigatorio: nao.

Regra:

```text
nao pode ser negativo
```

### parcelamento

Informacao estruturada sobre parcelamento.

Tipo futuro: `JSONB`.

Obrigatorio: nao.

Exemplo:

```json
{
  "max_parcelas": 2,
  "valor_parcela": 95.00,
  "sem_juros": true
}
```

### moeda

Moeda do preco.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Valor inicial:

- `BRL`

### tipo_preco

Tipo do preco.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores aprovados:

- `normal`
- `promocional`
- `sob_consulta`

### valido_de

Quando esse preco comeca a valer.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### valido_ate

Quando esse preco deixa de valer.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: nao.

Se vazio, vale ate ser substituido ou desativado.

### origem_preco

De onde veio o preco.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais:

- `importacao`
- `manual`
- `promocao`
- `ajuste`

### observacoes

Nota interna sobre o preco.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
nao dar desconto nesse produto
```

Regra:

```text
observacoes nao podem ser faladas ao cliente automaticamente
```

### ativo

Se esse registro de preco deve ser considerado.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

### criado_em

Quando o preco foi criado.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### atualizado_em

Quando o preco foi alterado.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

## Exemplo real

```text
produto: Pneu Maggion Viper 100/80-17
preco_avista: 180.00
preco_cartao: 190.00
parcelamento: {"max_parcelas":2,"valor_parcela":95.00,"sem_juros":true}
moeda: BRL
tipo_preco: normal
valido_de: hoje
valido_ate: vazio
origem_preco: importacao
ativo: sim
```

## View futura - precos atuais

View prevista:

```text
precos_atuais
```

Ela mostra somente o preco valido agora.

Regra aprovada:

```text
se houver mais de um preco valido ao mesmo tempo, menor preco ativo vence
```

## Regras importantes

- Preco nao pode ser negativo.
- Atendente so pode falar preco se a skill trouxe preco da tabela/view.
- Se `tipo_preco = sob_consulta`, humano precisa confirmar.
- A Atendente nao le a tabela bruta; ela le a view `precos_atuais`.
- Historico de precos deve ser preservado.
- Nao sobrescrever preco antigo quando preco mudar.

## Decisoes aprovadas

- Precos terao historico.
- Mudanca de preco cria nova linha com `valido_de`.
- `valido_ate` pode ficar vazio.
- `parcelamento` fica em JSONB para manter flexibilidade.
- Moeda inicial sera `BRL`.
- View `precos_atuais` protege a Atendente de pegar preco antigo.
- Menor preco ativo vence em caso de sobreposicao.

---

# Decisao - entrega e regioes

Status: substituida por duas tabelas.

Decisao:

```text
separar dicionario geografico de regra comercial de entrega
```

Esta secao foi dividida em:

- Tabela 8 - bairros e municipios;
- Tabela 9 - areas de entrega.

---

# Tabela 8 - bairros e municipios

Status: aprovada.

Nome tecnico futuro provavel: `commerce.geo_resolutions`.

## Para que serve

Serve como dicionario geografico.

Ela transforma o jeito que o cliente fala em uma localizacao padronizada.

Exemplo:

```text
"bonsucesso" -> bairro Bonsucesso, municipio Rio de Janeiro, UF RJ
```

## O que esta tabela nao faz

Nao diz se a loja entrega no local.

Nao calcula taxa.

Nao calcula prazo.

Nao conta quantas vezes o bairro apareceu.

Regra aprovada:

```text
bairros_municipios = dicionario geografico
analytics.* = contagem e relatorio
```

## Quem escreve

No v1:

- importacao CSV/planilha;
- ajuste manual.

No futuro:

- promocao de descoberta aprovada por humano;
- painel administrativo.

## Quem le

- LLM Organizadora;
- Context Builder;
- skill `calcular_entrega`;
- BI de geografia;
- tabela de areas de entrega.

## Campos

### identificador_interno

Identificador unico do registro geografico.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### ambiente

Define se o dado pertence ao ambiente de producao ou teste.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Exemplos:

- `prod`
- `test`

### termo_original

Texto como apareceu ou foi cadastrado.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplos:

- `Bonsucesso`
- `bonsucesso`
- `Bonsucesso RJ`

### termo_normalizado

Versao padronizada para busca.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplo:

```text
bonsucesso
```

### bairro

Nome oficial ou padronizado do bairro.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
Bonsucesso
```

### municipio

Cidade/municipio.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplo:

```text
Rio de Janeiro
```

### uf

Estado.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplo:

```text
RJ
```

### tipo_localidade

Tipo do local.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais:

- `bairro`
- `municipio`
- `regiao`
- `outro`

### fonte

De onde veio essa resolucao geografica.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais:

- `manual`
- `importacao`
- `web_aprovado`
- `chatwoot`
- `outro`

### nivel_confianca

Quanto confiamos nessa resolucao.

Tipo futuro: `NUMERIC(3,2)`.

Obrigatorio: sim.

Exemplos:

- `1.00` - certeza;
- `0.80` - boa confianca;
- `0.60` - exige cuidado.

### status_revisao

Estado de revisao humana.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores:

- `pendente`
- `aprovado`
- `rejeitado`

### observacoes

Nota interna sobre a localidade.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
confirmar se cliente se refere ao bairro no RJ
```

### criado_em

Quando foi cadastrado.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### atualizado_em

Quando foi alterado pela ultima vez.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### apagado_em

Soft delete.

Se preenchido, a localidade deixa de ser usada, mas o historico continua.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: nao.

## Campos que decidimos nao colocar

Nao colocar:

- `vezes_usado`;
- `ultimo_uso_em`.

Motivo:

```text
contador em dicionario geografico pode contar errado.
relatorio serio deve vir de analytics.conversation_facts.
```

## Exemplo real

```text
termo_original: Bonsucesso
termo_normalizado: bonsucesso
bairro: Bonsucesso
municipio: Rio de Janeiro
uf: RJ
tipo_localidade: bairro
fonte: manual
nivel_confianca: 1.00
status_revisao: aprovado
```

## Decisoes aprovadas

- Esta tabela e dicionario geografico, nao regra de entrega.
- Nao guarda taxa nem prazo.
- Nao guarda contador de uso.
- Contagem de bairros/municipios vem de `analytics.conversation_facts`.
- Futuramente, BI pode criar `analytics_marts.demanda_por_bairro`.
- Descobertas por internet ou Chatwoot entram como pendentes ate aprovacao.

---

# Tabela 9 - areas de entrega

Status: aprovada.

## Para que serve

Guarda a regra comercial de entrega por localidade.

Ela responde:

```text
a loja entrega nesse lugar?
quanto cobra?
qual prazo pode ser prometido?
precisa humano confirmar?
```

## Relacao com bairros e municipios

Esta tabela usa a Tabela 8 como base geografica.

Exemplo:

```text
bairros_municipios: Bonsucesso / Rio de Janeiro / RJ
areas_entrega: entrega sim, taxa R$ 10, prazo dia posterior
```

## Quem escreve

No v1:

- importacao CSV/planilha;
- ajuste manual.

No futuro:

- painel administrativo.

## Quem le

- skill `calcular_entrega`;
- Say Validator;
- Context Builder;
- relatorios de demanda por regiao.

## O que nao guarda

Nao guarda:

- bairro como dicionario geografico;
- produto;
- pedido;
- estoque;
- preco do produto;
- endereco completo do cliente.

## Campos

### identificador_interno

Identificador unico da regra de entrega.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### ambiente

Define se o dado pertence ao ambiente de producao ou teste.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Exemplos:

- `prod`
- `test`

### localidade_id

Link com a tabela `bairros e municipios`.

Tipo futuro: `UUID`.

Obrigatorio: sim.

Exemplo:

```text
Bonsucesso / Rio de Janeiro / RJ
```

### atende_entrega

Diz se a loja entrega nessa localidade.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

### taxa_entrega

Valor da entrega.

Tipo futuro: `NUMERIC(12,2)`.

Obrigatorio: nao.

Regra:

```text
nao pode ser negativa
```

### prazo_entrega

Prazo que pode ser comunicado ao cliente.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores aprovados:

- `dia_posterior` - entrega no dia posterior ao pedido;
- `sob_consulta` - humano precisa confirmar;
- `nao_entrega` - nao ha entrega para essa localidade.

Decisao aprovada:

```text
no v1, nao prometer entrega no mesmo dia
```

### permite_excecao_prazo

Indica se pode haver excecao, mas somente com humano confirmando.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

Regra:

```text
Atendente nao promete excecao sozinha
```

### retirada_disponivel

Se pode sugerir retirada na loja.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

### status_entrega

Estado da regra de entrega.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores:

- `ativo`
- `inativo`
- `sob_consulta`
- `nao_atende`

### tipo_cobertura

Nivel da regra.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores:

- `bairro`
- `municipio`
- `regiao`
- `manual`

Exemplos:

- regra especifica para Bonsucesso = `bairro`;
- regra geral para Rio de Janeiro = `municipio`.

### mensagem_cliente

Texto seguro que a Atendente pode usar.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
Entregamos em Bonsucesso. A entrega e no dia posterior ao pedido.
```

### observacoes_internas

Notas internas que nao devem ser faladas automaticamente.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
confirmar motoboy em dia de chuva
```

### ativo

Se a regra esta valendo.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

### criado_em

Quando a regra foi criada.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### atualizado_em

Quando a regra foi alterada pela ultima vez.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### apagado_em

Soft delete.

Se preenchido, a regra deixa de valer, mas o historico continua.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: nao.

## Exemplo real

```text
localidade: Bonsucesso / Rio de Janeiro / RJ
atende_entrega: sim
taxa_entrega: 10.00
prazo_entrega: dia_posterior
permite_excecao_prazo: sim
retirada_disponivel: sim
status_entrega: ativo
tipo_cobertura: bairro
mensagem_cliente: Entregamos em Bonsucesso. A entrega e no dia posterior ao pedido.
observacoes_internas: confirmar motoboy em dia de chuva
ativo: sim
```

## Respostas esperadas da Atendente

Se o cliente perguntar:

```text
Entrega em Bonsucesso?
```

Resposta segura:

```text
Entregamos em Bonsucesso. A entrega e no dia posterior ao pedido.
```

Se o cliente perguntar:

```text
Consegue hoje?
```

Resposta segura:

```text
Normalmente a entrega e no dia posterior ao pedido. Se precisar para hoje, posso confirmar com a loja pra voce.
```

## Regras importantes

- Se `atende_entrega = nao`, a Atendente nao pode prometer entrega.
- Se `status_entrega = sob_consulta`, humano confirma.
- Se `status_entrega = nao_atende`, nao oferecer entrega.
- Se `prazo_entrega = dia_posterior`, nao prometer mesmo dia.
- Se `permite_excecao_prazo = sim`, a Atendente pode oferecer confirmacao humana.
- `observacoes_internas` nao podem ser faladas ao cliente.
- `mensagem_cliente` pode ser usada diretamente.
- Se nao houver regra para a localidade, a Atendente deve dizer que vai verificar.

## Decisoes aprovadas

- Prazo padrao da entrega e no dia posterior ao pedido.
- Nao usar `prazo_min_minutos` e `prazo_max_minutos` no v1.
- Nao usar `entrega_mesmo_dia` no v1.
- Excecao de prazo exige humano.
- A tabela permite regra por bairro ou municipio.
- Se nao houver regra de bairro, pode usar regra mais geral de municipio.

---

# Tabela 10 - politicas da loja

Status: aprovada.

## Para que serve

Guarda informacoes oficiais da loja que a Atendente pode usar com seguranca.

Exemplos de perguntas que ela responde:

- qual horario;
- onde fica;
- aceita Pix;
- aceita cartao;
- tem garantia;
- faz montagem;
- pode retirar na loja.

## Quem escreve

No v1:

- importacao CSV/planilha;
- ajuste manual.

No futuro:

- painel administrativo.

## Quem le

- skill `responder_politica`;
- Context Builder;
- Say Validator;
- humano no painel futuro.

## O que nao guarda

Nao guarda:

- produto;
- preco;
- estoque;
- pedido;
- conversa;
- taxa/prazo por bairro.

Taxa e prazo por bairro ficam em `areas de entrega`.

## Campos

### identificador_interno

Identificador unico da politica.

Tipo futuro: `UUID`.

Obrigatorio: sim.

### ambiente

Define se o dado pertence ao ambiente de producao ou teste.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Exemplos:

- `prod`
- `test`

### chave_politica

Assunto que essa politica responde.

Tipo futuro: `TEXT` com valores permitidos.

Obrigatorio: sim.

Valores iniciais aprovados:

- `endereco`
- `horario_funcionamento`
- `formas_pagamento`
- `pix`
- `cartao`
- `parcelamento`
- `garantia`
- `montagem`
- `retirada`
- `telefone_humano`
- `link_maps`
- `politica_troca`
- `nota_fiscal`
- `observacao_geral`

Regra:

```text
chave_politica deve ser lista fechada, nao texto livre
```

### titulo

Nome legivel da politica.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplo:

```text
Horario de funcionamento
```

### conteudo_cliente

Texto seguro que a Atendente pode falar ao cliente.

Tipo futuro: `TEXT`.

Obrigatorio: sim.

Exemplo:

```text
Atendemos de segunda a sabado, das 9h as 18h.
```

### conteudo_interno

Observacao interna que nao deve ser falada automaticamente.

Tipo futuro: `TEXT`.

Obrigatorio: nao.

Exemplo:

```text
em feriados confirmar antes
```

Regra:

```text
conteudo_interno nunca pode ser falado automaticamente ao cliente
```

### valor_estruturado

JSON com dados estruturados, quando fizer sentido.

Tipo futuro: `JSONB`.

Obrigatorio: nao.

Exemplo para horario:

```json
{
  "segunda": "09:00-18:00",
  "sabado": "09:00-15:00"
}
```

Exemplo para pagamento:

```json
{
  "pix": true,
  "dinheiro": true,
  "debito": true,
  "credito": true
}
```

### ativo

Se essa politica esta valendo.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

### precisa_confirmacao_humana

Se a Atendente precisa confirmar com humano antes de responder.

Tipo futuro: `BOOLEAN`.

Obrigatorio: sim.

### criado_em

Quando a politica foi criada.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### atualizado_em

Quando a politica foi alterada pela ultima vez.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: sim.

### apagado_em

Soft delete.

Se preenchido, a politica deixa de ser usada, mas o historico continua.

Tipo futuro: `TIMESTAMPTZ`.

Obrigatorio: nao.

## Exemplo real

```text
chave_politica: formas_pagamento
titulo: Formas de pagamento
conteudo_cliente: Aceitamos Pix, dinheiro, cartao de debito e credito.
conteudo_interno: Parcelamento acima de 2x confirmar com Wallace.
valor_estruturado: {"pix":true,"dinheiro":true,"debito":true,"credito":true,"parcelamento":"confirmar acima de 2x"}
ativo: sim
precisa_confirmacao_humana: nao
```

## Regras importantes

- Atendente so pode responder politica usando `conteudo_cliente`.
- `conteudo_interno` nunca pode ser falado automaticamente.
- Se `precisa_confirmacao_humana = sim`, a Atendente deve dizer que vai confirmar.
- `chave_politica` deve ser lista fechada.
- Taxa/prazo por bairro nao fica aqui.
- Quando uma politica mudar, atualizar `atualizado_em`.

## Decisoes aprovadas

- Politicas da loja ficam em tabela propria.
- Comecar com poucas chaves no v1.
- Texto para cliente e texto interno ficam separados.
- `valor_estruturado` fica em JSONB para horarios, formas de pagamento e casos parecidos.
- A Atendente nao pode responder politica inventada fora dessa tabela.

## Chaves recomendadas para o v1

- `endereco`
- `horario_funcionamento`
- `formas_pagamento`
- `garantia`
- `montagem`
- `retirada`
- `telefone_humano`
- `link_maps`
- `nota_fiscal`

---

# Tabela 11 - importacoes de planilha

Status: aprovada.

## Para que serve

Registra cada lote de importacao CSV/planilha.

Ela responde:

```text
quem importou?
qual arquivo?
quando importou?
quantas linhas entraram?
quantas deram erro?
```

## Relacoes com outras tabelas

- `produtos`, `estoque`, `precos`, `veiculos`, `compatibilidades`, `bairros`, `areas_entrega` podem apontar para uma importacao.
- `erros_importacao` aponta para esta tabela.

## Campos

- `identificador_interno` - UUID, obrigatorio.
- `ambiente` - prod/test, obrigatorio.
- `tipo_importacao` - produtos, especificacoes_pneu, veiculos, compatibilidades, midias_produto, estoque, precos, bairros_municipios, areas_entrega, politicas_loja, outro.
- `nome_arquivo` - nome do arquivo importado.
- `hash_arquivo` - assinatura do arquivo para detectar duplicidade.
- `status_importacao` - recebida, processando, concluida, concluida_com_erros, falhou, cancelada.
- `total_linhas` - total de linhas.
- `linhas_processadas` - linhas processadas.
- `linhas_criadas` - linhas que criaram registros.
- `linhas_atualizadas` - linhas que atualizaram registros.
- `linhas_ignoradas` - linhas ignoradas.
- `linhas_com_erro` - linhas com erro.
- `importado_por` - wallace, sistema, importador.
- `origem` - upload_manual, google_sheets, api, sistema, outro.
- `iniciado_em` - inicio do processamento.
- `finalizado_em` - fim do processamento.
- `observacoes` - nota interna.
- `criado_em` - quando nasceu.
- `atualizado_em` - ultima alteracao.

## Regras

- Importacao precisa ser auditavel.
- Linha invalida nao pode poluir tabela oficial.
- Arquivo duplicado deve ser detectavel por `hash_arquivo`.
- Se falhou, precisa ter erro ou observacao.

---

# Tabela 12 - erros de importacao

Status: aprovada.

## Para que serve

Guarda cada linha de planilha que deu erro.

## Relacoes com outras tabelas

- Pertence a `importacoes de planilha`.
- Nao escreve direto em tabela oficial.

## Campos

- `identificador_interno` - UUID, obrigatorio.
- `ambiente` - prod/test, obrigatorio.
- `importacao_id` - link com importacoes de planilha.
- `numero_linha` - linha do arquivo.
- `tabela_destino` - para onde a linha iria.
- `codigo_erro` - tipo do erro.
- `mensagem_erro` - explicacao em portugues.
- `linha_original` - JSON com os dados da linha.
- `campo_com_erro` - campo problemático, se houver.
- `valor_com_erro` - valor problemático, se houver.
- `status_revisao` - pendente, corrigido, ignorado.
- `corrigido_por` - quem corrigiu.
- `corrigido_em` - quando corrigiu.
- `criado_em` - quando o erro foi registrado.

## Exemplos de erro

- medida invalida;
- preco negativo;
- produto sem codigo;
- veiculo nao encontrado;
- bairro sem municipio;
- compatibilidade duplicada.

## Regras

- Erro fica separado da tabela oficial.
- Corrigir erro nao deve apagar o historico.
- Importacao com erros pode ser parcialmente concluida, mas precisa ficar visivel.

---

# Tabela 13 - compatibilidades descobertas

Status: aprovada.

## Para que serve

Guarda compatibilidades encontradas por pesquisa, conversa ou web, mas ainda nao oficiais.

Ela e a sala de espera antes de virar `compatibilidade veiculo-pneu`.

## Relacoes com outras tabelas

- Pode apontar para `veiculos`.
- Pode apontar para `especificacoes do pneu`.
- Quando aprovada e promovida, cria uma linha oficial em `compatibilidade veiculo-pneu`.

## Campos

- `identificador_interno` - UUID, obrigatorio.
- `ambiente` - prod/test, obrigatorio.
- `texto_consulta` - texto original usado na descoberta.
- `veiculo_id` - link opcional com veiculo ja conhecido.
- `veiculo_texto` - veiculo em texto, se ainda nao mapeado.
- `medida_texto` - medida encontrada em texto.
- `especificacao_pneu_id` - link opcional com especificacao existente.
- `posicao_tecnica` - dianteiro, traseiro, ambos, nao_informado.
- `tipo_compatibilidade_sugerida` - original, alternativa_aprovada, adaptacao, nao_recomendada.
- `fonte` - manual, web, chatwoot, importacao, outro.
- `url_fonte` - link consultado, se houver.
- `nivel_confianca` - 0.00 a 1.00.
- `status_revisao` - pending, approved, rejected, promoted.
- `revisado_por` - humano que revisou.
- `revisado_em` - quando revisou.
- `promovido_para_compatibilidade_id` - link para a tabela oficial, quando promovido.
- `observacoes` - notas internas.
- `criado_em` - quando nasceu.
- `atualizado_em` - ultima alteracao.

## Regras

- Descoberta pendente nao e verdade oficial.
- Atendente nao pode vender como certeza com base em descoberta pendente.
- Humano aprova antes de promover.
- `approved` e decisao humana; `promoted` e efeito aplicado na tabela oficial.

---

# Tabela 14 - pedidos

Status: aprovada como schema preparado. Uso automatico fica desligado no v1.

## Para que serve

Guarda pedido real, depois de confirmacao humana ou transacao segura.

No v1, a Atendente monta rascunho e escala humano. Pedido automatico fica desligado.

## Relacoes com outras tabelas

- Liga com `core.contacts`.
- Liga com `core.conversations`.
- Tem itens em `itens do pedido`.
- Pode nascer a partir de `agent.order_drafts`, mas nao e a mesma coisa.

## Campos

- `identificador_interno` - UUID, obrigatorio.
- `ambiente` - prod/test, obrigatorio.
- `contato_id` - cliente em `core.contacts`.
- `conversa_id` - conversa que originou.
- `status_pedido` - rascunho_humano, confirmado, cancelado, entregue, falhou.
- `criado_por` - agent, human, import, api.
- `valor_produtos` - soma dos itens.
- `taxa_entrega` - valor da entrega.
- `valor_total` - total final.
- `forma_pagamento` - pix, dinheiro, debito, credito, outro, sob_consulta.
- `modalidade_entrega` - entrega, retirada.
- `localidade_id` - bairro/municipio, se entrega.
- `endereco_entrega` - JSON ou texto estruturado.
- `observacoes_cliente` - observacao que pode aparecer no pedido.
- `observacoes_internas` - nota interna.
- `agent_turn_id` - turno do agente que sugeriu, se houver.
- `confirmado_por` - humano/sistema que confirmou.
- `confirmado_em` - quando confirmou.
- `cancelado_em` - se cancelado.
- `motivo_cancelamento` - se houver.
- `criado_em` - quando nasceu.
- `atualizado_em` - ultima alteracao.

## Regras

- No v1, Atendente nao cria pedido automaticamente.
- Pedido real so nasce apos humano confirmar ou handler transacional futuro.
- Pedido nao deve ser criado se estoque/preco nao estiverem validados.
- Pedido preserva historico comercial, mesmo se produto sair de linha.

---

# Tabela 15 - itens do pedido

Status: aprovada como schema preparado.

## Para que serve

Guarda os produtos dentro de um pedido.

## Relacoes com outras tabelas

- Pertence a `pedidos`.
- Aponta para `produtos`.
- Pode registrar qual preco foi usado no momento da venda.

## Campos

- `identificador_interno` - UUID, obrigatorio.
- `ambiente` - prod/test, obrigatorio.
- `pedido_id` - link com pedidos.
- `produto_id` - link com produtos.
- `quantidade` - quantidade vendida.
- `preco_unitario` - preco unitario usado.
- `preco_total` - quantidade x preco_unitario.
- `preco_origem_id` - link opcional com precos.
- `nome_produto_no_momento` - copia do nome na hora da venda.
- `codigo_produto_no_momento` - copia do codigo na hora da venda.
- `observacoes` - nota interna.
- `criado_em` - quando nasceu.

## Regras

- Guardar nome/codigo no momento protege historico se produto mudar depois.
- Quantidade precisa ser maior que zero.
- Preco nao pode ser negativo.

---

# Tabela 16 - sessoes atuais do agente

Status: aprovada como planejamento.

## Para que serve

Guarda a fotografia atual do atendimento automatizado.

## Relacoes com outras tabelas

- Liga com `core.conversations`.
- E atualizada a partir de `eventos da sessao`.
- Lida pelo Context Builder.

## Campos

- `conversa_id` - chave principal.
- `ambiente` - prod/test.
- `status_sessao` - active, paused, escalated, closed.
- `skill_atual` - skill conversacional atual.
- `ultima_mensagem_cliente_id` - ultima mensagem incoming processada.
- `ultimo_turno_agente_id` - ultimo turno gerado.
- `atendente_habilitado` - feature flag por sessao, se necessario.
- `criado_em` - quando nasceu.
- `atualizado_em` - ultima alteracao.

## Regras

- Snapshot pode ser atualizado.
- Historico fica em `eventos da sessao`.
- No Shadow Assistido, pode existir ou ficar vazio, pois Atendente fica desligada.

---

# Tabela 17 - eventos da sessao

Status: aprovada como planejamento.

## Para que serve

Historico imutavel do que aconteceu na sessao do agente.

## Relacoes com outras tabelas

- Alimenta/reconstroi `sessoes atuais do agente`.
- Pode apontar para `turnos do agente`.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `conversa_id` - conversa.
- `tipo_evento` - skill_selected, slot_saved, escalation_created, bot_returned, session_closed, outro.
- `payload` - JSON com detalhe.
- `origem` - system, agent, human.
- `turno_agente_id` - opcional.
- `criado_em` - quando aconteceu.

## Regras

- Append-only.
- Nao apagar evento.
- Snapshot atual deve ser regeneravel a partir daqui.

---

# Tabela 18 - turnos do agente

Status: aprovada como planejamento.

## Para que serve

Guarda cada vez que a LLM Atendente gerou resposta.

## Relacoes com outras tabelas

- Liga com `core.messages` pelo gatilho.
- Pode gerar resposta no Chatwoot.
- Pode gerar actions executadas por action handlers.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `conversa_id` - conversa.
- `mensagem_gatilho_id` - mensagem do cliente que disparou.
- `versao_agente` - versao/prompt.
- `skill_escolhida` - skill conversacional.
- `contexto_hash` - hash do contexto usado.
- `entrada_llm` - JSON resumido ou referencia.
- `saida_llm` - JSON `{say, actions}`.
- `status_turno` - pending, sent, blocked, failed, skipped.
- `mensagem_resposta_id` - mensagem outgoing no Chatwoot/core, se enviada.
- `erro` - erro, se houver.
- `criado_em` - quando nasceu.
- `atualizado_em` - ultima alteracao.

## Regras

- Idempotencia por `mensagem_gatilho_id + versao_agente`.
- LLM nunca grava direto; turno registra proposta e resultado.

---

# Tabela 19 - confirmacoes pendentes

Status: aprovada como planejamento.

## Para que serve

Guarda perguntas que o agente fez e esta esperando resposta.

Exemplo:

```text
E Bros 160 traseira, certo?
```

## Relacoes com outras tabelas

- Liga com `core.messages`.
- Quando resolvida, pode gerar fato confirmado em `analytics.conversation_facts`.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `conversa_id` - conversa.
- `tipo_confirmacao` - fact, cart_item, order, address, payment.
- `fatos_esperados` - JSON com chaves/valores esperados.
- `mensagem_pergunta_id` - mensagem onde o agente perguntou.
- `status_confirmacao` - pending, confirmed, rejected, expired.
- `expira_em` - validade.
- `mensagem_resolucao_id` - mensagem do cliente que resolveu.
- `resolvido_em` - quando resolveu.
- `criado_em` - quando nasceu.

## Regras

- "Sim" so confirma se houver confirmacao pendente.
- Confirmacao explicita pode virar fato `confirmado_cliente`.
- Expiracao evita confirmar coisa velha.

---

# Tabela 20 - carrinho atual

Status: aprovada como planejamento.

## Para que serve

Fotografia atual do que o cliente esta considerando comprar.

## Relacoes com outras tabelas

- Tem itens em `itens do carrinho atual`.
- Historico fica em `eventos do carrinho`.
- Pode alimentar `rascunho do pedido`.

## Campos

- `conversa_id` - chave principal.
- `ambiente` - prod/test.
- `status_carrinho` - empty, proposed, confirmed, validated, escalated, promoted, cleared.
- `observacoes` - nota interna.
- `criado_em` - quando nasceu.
- `atualizado_em` - ultima alteracao.

## Regras

- Snapshot operacional.
- Eventos sao a verdade auditavel.

---

# Tabela 21 - itens do carrinho atual

Status: aprovada como planejamento.

## Para que serve

Guarda os itens vivos do carrinho.

## Relacoes com outras tabelas

- Pertence a `carrinho atual`.
- Aponta para `produtos`.
- Pode ter preco cotado vindo de `precos atuais`.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `conversa_id` - conversa/carrinho.
- `produto_id` - produto.
- `quantidade` - quantidade.
- `preco_cotado` - preco mostrado ao cliente.
- `preco_origem_id` - origem do preco.
- `estoque_verificado_em` - quando conferiu estoque.
- `status_item` - proposed, confirmed, validated, removed, replaced.
- `criado_em` - quando nasceu.
- `atualizado_em` - ultima alteracao.

## Regras

- Item de carrinho nao e pedido.
- Produto pode mudar via evento `replaced`.
- Preco cotado deve vir de fonte valida.

---

# Tabela 22 - eventos do carrinho

Status: aprovada como planejamento.

## Para que serve

Historico imutavel de mudancas no carrinho.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `conversa_id` - conversa.
- `tipo_evento` - proposed, confirmed, validated, promoted, removed, replaced, cleared.
- `payload` - JSON com detalhe.
- `turno_agente_id` - turno que causou, se houver.
- `mensagem_cliente_id` - evidencia, se houver.
- `criado_em` - quando aconteceu.

## Regras

- Append-only.
- `carrinho atual` e projecao desses eventos.

---

# Tabela 23 - rascunhos de pedido

Status: aprovada como planejamento.

## Para que serve

Guarda slots de checkout antes de virar pedido real.

## Relacoes com outras tabelas

- Liga com conversa.
- Usa itens do carrinho.
- Pode virar pedido no futuro, mas no v1 escala humano.

## Campos

- `conversa_id` - chave principal.
- `ambiente` - prod/test.
- `nome_cliente` - se coletado.
- `modalidade` - entrega, retirada, sob_consulta.
- `localidade_id` - bairro/municipio.
- `endereco_entrega` - JSON/texto estruturado.
- `forma_pagamento` - pix, dinheiro, debito, credito, outro, sob_consulta.
- `status_rascunho` - collecting, ready_for_human, escalated, promoted, cancelled.
- `observacoes_cliente` - observacao do cliente.
- `observacoes_internas` - nota interna.
- `pedido_promovido_id` - link com `pedidos`, quando virar pedido real.
- `promovido_por` - humano ou handler que promoveu.
- `promovido_em` - quando virou pedido real.
- `criado_em` - quando nasceu.
- `atualizado_em` - ultima alteracao.

## Regras

- Rascunho fica em `agent.*`, nao em `commerce.*`.
- Pedido real so nasce em `commerce.orders`.
- No v1, pronto para fechar vira escalacao humana.
- Quando humano fechar no v1, o rascunho nao some: muda para `promoted` e guarda `pedido_promovido_id`.
- Se o cliente desistir, o rascunho muda para `cancelled`, preservando historico.
- No v2, o handler transacional podera promover o rascunho automaticamente sem mudar o schema.

---

# Tabela 24 - escalacoes

Status: aprovada como planejamento.

## Para que serve

Guarda quando o bot passa a conversa para humano.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `conversa_id` - conversa.
- `motivo` - cliente_pediu_humano, pagamento_enviado, atacado, reclamacao, loop, pedido_pronto, risco, outro.
- `origem` - hint, estado, action, humano.
- `status_escalacao` - aguardando, em_atendimento, resolvida, devolvida_bot.
- `mensagem_origem_id` - mensagem que motivou.
- `turno_agente_id` - turno relacionado.
- `resumo_para_humano` - texto estruturado para nota interna no Chatwoot.
- `resolvido_por` - humano que resolveu.
- `resolvido_em` - quando resolveu.
- `criado_em` - quando nasceu.
- `atualizado_em` - ultima alteracao.

## Regras

- No v1, pedido pronto gera escalacao.
- Chatwoot recebe nota interna com resumo.
- `devolvida_bot` permite humano resolver ponto sensivel e bot continuar depois.

---

# Tabela 25 - fila da Atendente

Status: aprovada como planejamento.

## Para que serve

Fila de baixa latencia para a Atendente responder cliente sem travar webhook.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `conversa_id` - conversa.
- `mensagem_gatilho_id` - mensagem incoming.
- `status_job` - pending, processing, processed, failed, skipped.
- `tentativas` - quantidade de tentativas.
- `not_before` - nao processar antes desse horario.
- `locked_at` - quando worker pegou.
- `locked_by` - worker.
- `erro` - erro, se houver.
- `criado_em` - quando nasceu.
- `processado_em` - quando finalizou.

## Regras

- Um job por mensagem incoming do cliente.
- Outgoing do bot nao cria job.
- Usar `FOR UPDATE SKIP LOCKED`.
- Webhook sempre responde 200 rapido.

---

# Tabela 26 - evidencias dos fatos

Status: aprovada como planejamento.

## Para que serve

Guarda a prova de cada fato extraido.

## Relacoes com outras tabelas

- Aponta para `analytics.conversation_facts`.
- Aponta para `core.messages`.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `fato_id` - link com fato.
- `mensagem_id` - mensagem que sustenta.
- `texto_evidencia` - trecho literal.
- `inicio_evidencia` - posicao inicial, se possivel.
- `fim_evidencia` - posicao final, se possivel.
- `tipo_evidencia` - text, attachment, audio_transcript, system.
- `contribuicao_confianca` - 0.00 a 1.00.
- `criado_em` - quando nasceu.

## Regras

- Fato LLM precisa de evidencia.
- `texto_evidencia` deve ser literal quando for texto.
- Sem evidencia, nao grava fato interpretativo.

---

# Tabela 27 - mensagens sem skill adequada

Status: aprovada como planejamento.

## Para que serve

Registra mensagens que cairam em `responder_geral`.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `conversa_id` - conversa.
- `mensagem_id` - mensagem do cliente.
- `texto_mensagem` - texto original ou trecho.
- `motivo_fallback` - router_no_skill, politica_ausente, dado_ausente, outro.
- `skill_usada` - geralmente responder_geral.
- `revisado_em` - quando humano revisou.
- `promovido_para_skill` - se virou skill/regra nova.
- `observacoes` - nota interna.
- `criado_em` - quando nasceu.

## Regras

- Toda ativacao de `responder_geral` deve registrar aqui.
- Esta tabela mostra o que o sistema ainda nao sabe atender bem.

---

# Tabela 28 - incidentes do agente

Status: aprovada como planejamento.

## Para que serve

Guarda bloqueios e falhas de seguranca/operacao do agente.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `conversa_id` - conversa, se houver.
- `turno_agente_id` - turno, se houver.
- `tipo_incidente` - validator_blocked, llm_timeout, llm_api_error, pending_confirmation_expired, transaction_rollback, router_no_skill_matched, evidence_not_literal, schema_violation.
- `severidade` - low, medium, high, critical.
- `detalhes` - JSON.
- `resolvido_em` - se resolvido.
- `criado_em` - quando nasceu.

## Regras

- Say Validator e Action Validator registram aqui quando bloqueiam.
- Incidente nao deve ser escondido em log solto.

---

# Tabela 29 - fila da Organizadora

Status: aprovada como planejamento.

## Para que serve

Fila de enriquecimento da LLM Organizadora.

## Campos

- `identificador_interno` - UUID.
- `ambiente` - prod/test.
- `conversa_id` - conversa.
- `job_type` - organize_conversation, reenrich_conversation, backfill.
- `status_job` - pending, processing, processed, failed, skipped.
- `last_message_id` - ate qual mensagem deve processar.
- `last_processed_message_id` - ate qual processou.
- `not_before` - debounce 60-120s.
- `tentativas` - quantidade de tentativas.
- `locked_at` - quando worker pegou.
- `locked_by` - worker.
- `erro` - erro, se houver.
- `criado_em` - quando nasceu.
- `processado_em` - quando finalizou.

## Regras

- Um job por conversa, com upsert.
- Incoming novo atualiza o job.
- Outgoing do bot pode ser contexto, mas nao gera fato sobre cliente sozinho.
- Organizadora roda async.

---

# Views planejadas

Status: aprovadas como planejamento.

## `fatos_atuais`

Mostra o fato atual por conversa e chave.

Fonte: `analytics.conversation_facts` + supersedencia.

## `classificacoes_atuais`

Mostra a classificacao atual por conversa e dimensao.

## `precos_atuais`

Mostra preco valido agora.

Regra: menor preco ativo vence em sobreposicao.

## `perfil_comercial_cliente`

Calcula historico comercial do cliente a partir de pedidos.

## `demanda_por_bairro` futura

BI futuro usando `analytics.conversation_facts`, nao contador em `bairros_municipios`.

---

# Relacoes principais entre tabelas

```text
produtos
  -> especificacoes_pneu
  -> midias_produto
  -> estoque
  -> precos

veiculos
  -> compatibilidade_veiculo_pneu
  -> especificacoes_pneu
  -> produtos por medida

bairros_municipios
  -> areas_entrega
  -> rascunhos_pedido / pedidos

importacoes_planilha
  -> erros_importacao
  -> pode alimentar produtos, estoque, precos, veiculos e areas

core.conversations
  -> sessoes_atuais
  -> turnos_agente
  -> carrinho_atual
  -> rascunhos_pedido
  -> escalacoes

core.messages
  -> turnos_agente
  -> confirmacoes_pendentes
  -> evidencias_fatos

conversation_facts
  -> evidencias_fatos

pedidos
  -> itens_pedido
  -> produtos
```

---

# Estado deste documento

As tabelas acima sao planejamento em portugues.

Ainda falta, antes de SQL:

- revisar com Opus;
- traduzir nomes para ingles tecnico;
- atualizar `DATA_DICTIONARY.md`;
- criar migrations idempotentes;
- testar em Postgres real.
