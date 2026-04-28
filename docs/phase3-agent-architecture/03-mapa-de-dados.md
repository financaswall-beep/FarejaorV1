# 03 - Mapa de Dados Que Queremos Capturar

Este documento lista os dados que fariam Wallace ser "rei dos dados".

Nem tudo entra no v1. A lista existe para nao esquecer perguntas de negocio importantes.

## Cliente

- nome;
- telefone;
- cidade;
- bairro;
- canal de origem;
- como conheceu a loja;
- cliente novo ou recorrente;
- possivel atacado;
- nivel de urgencia;
- horario em que costuma chamar;
- historico de compras;
- historico de perdas;
- veiculos associados.

## Veiculo

- tipo: moto agora, carro no futuro;
- marca;
- modelo;
- cilindrada;
- ano;
- versao;
- uso: trabalho, passeio, entrega, aplicativo, viagem;
- posicao do pneu: dianteiro, traseiro, ambos;
- medida informada;
- medida correta;
- se cliente sabe a medida;
- se precisa confirmar compatibilidade.

## Produto procurado

- medida procurada;
- marca preferida;
- marca recusada;
- faixa de preco desejada;
- preferencia por barato;
- preferencia por durabilidade;
- preferencia por marca conhecida;
- preferencia por pronta entrega;
- aceita alternativa;
- produto fora do catalogo;
- quantidade desejada.

## Estoque e demanda

- produto estava em estoque;
- havia alternativa compativel;
- produto oferecido;
- produto aceito;
- produto recusado;
- medida mais procurada;
- medida mais perdida por falta de estoque;
- marca mais pedida;
- marca mais vendida;
- marca mais recusada;
- estoque que mais gira;
- estoque parado.

## Preco

- preco ofertado;
- preco que cliente achou caro;
- preco do concorrente;
- cliente pediu desconto;
- perguntou parcelamento;
- forma de pagamento desejada;
- aceitou preco;
- recusou por preco;
- ticket medio por medida, bairro e canal.

## Entrega e localizacao

- bairro citado;
- municipio;
- endereco aproximado, se informado;
- entrega ou retirada;
- taxa de entrega;
- prazo prometido;
- pergunta sobre entrega hoje;
- bairro mais recorrente;
- bairro que mais compra;
- bairro que mais perde venda.

## Funil

- etapa atual;
- entrou curioso ou pronto para comprar;
- confirmou moto;
- confirmou medida;
- recebeu oferta;
- recebeu preco;
- perguntou entrega;
- pediu desconto;
- demonstrou intencao;
- confirmou pedido;
- abandonou;
- voltou depois;
- precisou de humano;
- mensagens ate oferta;
- mensagens ate fechamento.

## Motivo de compra

- pneu furou;
- pneu careca;
- troca preventiva;
- viagem;
- trabalho/app/delivery;
- seguranca;
- indicacao de mecanico;
- promocao;
- urgencia.

## Motivo de perda

- preco;
- sem estoque;
- entrega nao atende;
- prazo ruim;
- cliente sumiu;
- comprou no concorrente;
- queria marca especifica;
- nao confiou na marca oferecida;
- forma de pagamento;
- atendimento demorou;
- duvida nao resolvida;
- pediu humano e nao foi atendido.

## Concorrencia

- nome do concorrente;
- preco do concorrente;
- prazo do concorrente;
- marca oferecida pelo concorrente;
- print/orcamento externo;
- concorrente ganha por preco, prazo ou marca;
- bairros onde concorrente aparece mais.

## Atendimento e agente

- tempo da primeira resposta;
- tempo medio entre mensagens;
- numero de mensagens;
- skill ativada;
- skill que mais converte;
- skill que mais falha;
- fallback `responder_geral`;
- resposta bloqueada por validador;
- timeout da LLM;
- custo estimado por conversa;
- versao do agente;
- confianca media dos fatos.

## Pedido e pos-venda

- pedido criado;
- fechado por humano ou agente;
- produto vendido;
- quantidade;
- valor total;
- forma de pagamento;
- entrega ou retirada;
- bairro de entrega;
- produto ofertado era o vendido;
- houve troca antes de fechar;
- pedido cancelado;
- reclamacao pos-venda;
- garantia acionada;
- cliente voltou a comprar.

