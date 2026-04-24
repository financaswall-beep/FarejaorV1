# Guia das Tabelas do Farejador

Atualizado: 24/04/2026

Este documento foi escrito para estudar o sistema sem precisar entender SQL.

A ideia e simples: cada tabela e como uma planilha organizada. Cada linha guarda
um acontecimento, uma pessoa, uma conversa, uma mensagem ou uma analise futura.

## Como pensar no banco

O Farejador separa os dados em quatro "andares":

| Andar | Nome tecnico | Explicacao simples |
| --- | --- | --- |
| Entrada bruta | `raw` | Guarda exatamente o que chegou do Chatwoot, sem mexer. |
| Dados organizados | `core` | Transforma o bruto em contatos, conversas, mensagens, anexos etc. |
| Relatorios inteligentes | `analytics` | Vai guardar metricas, classificacoes e sinais de negocio. |
| Controle do sistema | `ops` | Guarda filas, logs, snapshots e tarefas operacionais. |

Pense assim:

```text
Chatwoot manda evento
        |
        v
raw guarda o evento bruto
        |
        v
core organiza em tabelas de negocio
        |
        v
analytics gera relatorios e inteligencia
        |
        v
ops controla jobs, replay, LGPD e operacao
```

## Campo comum: `environment`

Quase toda tabela tem o campo `environment`.

Ele diz se o dado e:

- `prod`: dado real de producao;
- `test`: dado de teste.

Isso existe para impedir uma besteira perigosa: misturar conversa real de cliente
com conversa de teste.

---

# 1. Tabelas de entrada bruta (`raw`)

Estas tabelas sao a memoria original do sistema.

Elas respondem:

- "O Chatwoot mandou esse evento mesmo?"
- "Quando chegou?"
- "Ja recebemos esse webhook antes?"
- "Da para reprocessar esse evento?"

## `raw.delivery_seen`

### Em portugues simples

Essa tabela e o porteiro anti-duplicata.

Antes de aceitar um webhook, o Farejador pergunta:

> "Esse ID de entrega do Chatwoot ja passou por aqui?"

Se ja passou, o sistema nao grava tudo de novo.

### Por que ela existe

O Chatwoot pode reenviar o mesmo webhook quando acha que houve falha, timeout ou
retry. Sem essa tabela, o banco poderia receber mensagens duplicadas.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `environment` | Se o evento e de producao ou teste. |
| `chatwoot_delivery_id` | O ID unico da entrega do webhook. E a chave para saber se e duplicado. |
| `first_seen_at` | Quando esse webhook apareceu pela primeira vez. |
| `raw_event_id` | Link informativo para o evento bruto gravado em `raw.raw_events`. |

### Que relatorios/controles ela permite

- Quantos webhooks duplicados o Chatwoot reenviou.
- Se o sistema esta protegendo bem contra retry.
- Auditoria de "esse evento ja tinha chegado antes?".

## `raw.raw_events`

### Em portugues simples

Essa e a caixa-preta do Farejador.

Ela guarda o evento bruto que veio do Chatwoot, praticamente como chegou.

Se um dia algo der errado na normalizacao, podemos voltar aqui e dizer:

> "Vamos reprocessar esse evento original."

### Por que ela existe

Porque o dado bruto e a fonte da verdade. Mesmo que um mapper tenha bug ou uma
tabela `core` fique errada, o evento original continua guardado.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | Numero interno do evento bruto. |
| `environment` | Producao ou teste. |
| `chatwoot_delivery_id` | ID de entrega enviado pelo Chatwoot. |
| `chatwoot_signature` | Assinatura HMAC recebida. Serve para auditoria. |
| `chatwoot_timestamp` | Hora em que o Chatwoot disse que enviou o evento. |
| `received_at` | Hora em que o Farejador recebeu o evento. |
| `event_type` | Tipo do evento: mensagem criada, conversa atualizada, contato criado etc. |
| `account_id` | ID da conta Chatwoot. |
| `payload` | O JSON bruto do Chatwoot. Aqui esta o corpo original. |
| `processing_status` | Estado da normalizacao: pendente, processado, falhou ou ignorado. |
| `processed_at` | Quando o worker tentou/processou o evento. |
| `processing_error` | Erro registrado se a normalizacao falhou. |

### Estados de processamento

| Status | Explicacao simples |
| --- | --- |
| `pending` | Chegou, mas ainda nao foi transformado em tabelas organizadas. |
| `processed` | Foi transformado com sucesso em `core.*`. |
| `failed` | Deu erro ao processar. Pode ser reprocessado depois. |
| `skipped` | O sistema decidiu ignorar, normalmente por evento desconhecido. |

### Que relatorios/controles ela permite

- Quantos webhooks chegaram por dia.
- Quais tipos de eventos mais aparecem.
- Quantos eventos falharam.
- Quanto tempo demora entre chegada e processamento.
- Replay/reprocessamento de eventos com erro.

---

# 2. Tabelas organizadas do negocio (`core`)

Estas tabelas sao o coracao operacional.

Elas transformam o JSON bruto em coisas que uma pessoa entende:

- contato;
- conversa;
- mensagem;
- anexo;
- etiqueta;
- mudanca de status;
- atribuicao de agente.

Regra importante: `core` nao interpreta. Ele nao decide se vendeu, se perdeu, se o
cliente esta bravo, se e oportunidade boa. Ele so organiza o que aconteceu.

## `core.contacts`

### Em portugues simples

Essa tabela guarda os clientes/contatos que aparecem no Chatwoot.

Cada linha e uma pessoa ou contato.

### Exemplo

Um cliente chama no WhatsApp. O Chatwoot tem um ID para esse contato. O Farejador
cria/atualiza uma linha aqui.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno do contato dentro do Farejador. |
| `environment` | Producao ou teste. |
| `chatwoot_contact_id` | ID do contato no Chatwoot. |
| `name` | Nome do cliente, se existir. |
| `phone_e164` | Telefone do cliente em formato padrao. |
| `email` | Email do cliente. |
| `identifier` | Identificador externo/customizado. |
| `channel_type` | Canal relacionado: WhatsApp, Instagram, Facebook, web etc. |
| `country` | Pais do contato, se vier. |
| `city` | Cidade do contato, se vier. |
| `custom_attributes` | Campos customizados do Chatwoot. |
| `first_seen_at` | Primeira vez em que vimos esse contato. |
| `last_seen_at` | Ultima vez em que vimos esse contato. |
| `created_at` | Quando a linha foi criada no Farejador. |
| `updated_at` | Quando a linha foi atualizada. |
| `deleted_at` | Quando o contato foi apagado/anonimizado por LGPD. |
| `last_event_at` | Hora do ultimo evento que atualizou esse contato. Protege contra evento velho sobrescrever novo. |

### Que relatorios isso permite

Agora ou futuramente:

- Quantos contatos novos chegaram por dia.
- Quantos clientes voltam mais de uma vez.
- Quais canais trazem mais contatos.
- Quais cidades aparecem mais.
- Base para jornada do cliente.
- Base para LGPD/anonimizacao.

## `core.conversations`

### Em portugues simples

Essa tabela guarda as conversas do Chatwoot.

Cada linha e uma conversa, nao uma mensagem.

Uma conversa pode ter varias mensagens, tags, status e agentes envolvidos.

### Exemplo

Cliente pergunta "tem pneu 100/80-18?". Isso abre uma conversa. Toda a conversa
fica representada aqui, e as mensagens ficam em `core.messages`.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno da conversa no Farejador. |
| `environment` | Producao ou teste. |
| `chatwoot_conversation_id` | ID da conversa no Chatwoot. |
| `chatwoot_account_id` | ID da conta Chatwoot. |
| `chatwoot_inbox_id` | ID da inbox/canal no Chatwoot. |
| `channel_type` | Canal: WhatsApp, Instagram, Facebook, web etc. |
| `contact_id` | Link para o contato em `core.contacts`. |
| `current_status` | Status atual: aberta, resolvida, pendente ou snoozed. |
| `current_assignee_id` | Agente atual responsavel. |
| `current_team_id` | Time atual responsavel. |
| `priority` | Prioridade da conversa. |
| `started_at` | Quando a conversa comecou. |
| `first_reply_at` | Quando houve a primeira resposta do agente. |
| `last_activity_at` | Ultima atividade da conversa. |
| `resolved_at` | Quando a conversa foi resolvida. |
| `waiting_since` | Desde quando esta aguardando. |
| `message_count_cache` | Contador de mensagens para acelerar consulta. |
| `additional_attributes` | Dados extras do Chatwoot. |
| `custom_attributes` | Campos customizados do Chatwoot. |
| `created_at` | Quando a linha foi criada. |
| `updated_at` | Quando foi atualizada. |
| `deleted_at` | Soft-delete. |
| `last_event_at` | Ultimo evento que atualizou a conversa. |

### Que relatorios isso permite

Agora ou futuramente:

- Quantas conversas entram por dia.
- Quantas estao abertas, pendentes ou resolvidas.
- Tempo medio ate resolver.
- Tempo ate primeira resposta.
- Conversas por canal.
- Conversas por agente/time.
- Conversas com prioridade alta.
- Base para funil comercial.

## `core.messages`

### Em portugues simples

Essa tabela guarda cada mensagem enviada ou recebida.

Cada linha e uma mensagem.

Essa tende a ser uma das tabelas mais importantes do sistema, porque e nela que
esta o texto que depois pode gerar analises.

### Exemplo

Cliente: "Bom dia, tem pneu 90/90-18?"

Essa frase vira uma linha em `core.messages`.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno da mensagem. |
| `environment` | Producao ou teste. |
| `chatwoot_message_id` | ID da mensagem no Chatwoot. |
| `conversation_id` | Link para a conversa no Farejador. |
| `chatwoot_conversation_id` | ID da conversa no Chatwoot. |
| `sender_type` | Quem enviou: contato, usuario/agente, bot ou sistema. |
| `sender_id` | ID de quem enviou, se conhecido. |
| `message_type` | Codigo do tipo da mensagem no Chatwoot. |
| `message_type_name` | Nome legivel do tipo: incoming, outgoing, activity, template. |
| `content` | Texto da mensagem. |
| `content_type` | Tipo de conteudo: texto, card, formulario etc. |
| `content_attributes` | Metadados extras da mensagem. |
| `is_private` | Se e nota interna. Importante: nao usar em dataset de treino. |
| `status` | Status da mensagem: enviada, entregue, lida, falha etc. |
| `external_source_ids` | IDs externos, como IDs do WhatsApp/Meta. |
| `echo_id` | Campo usado pelo Chatwoot para dedup em alguns casos. |
| `sent_at` | Quando a mensagem foi enviada/criada. |
| `created_at` | Quando entrou no Farejador. |
| `deleted_at` | Soft-delete da mensagem. |
| `last_event_at` | Ultimo evento que atualizou essa mensagem. |

### Que relatorios isso permite

Agora ou futuramente:

- Quantidade de mensagens por conversa.
- Quantas mensagens o cliente mandou antes de comprar/desistir.
- Tempo medio de resposta.
- Palavras mais frequentes.
- Perguntas mais comuns.
- Produtos mais pedidos.
- Deteccao futura de intencao de compra.
- Deteccao futura de reclamacao de preco.
- Base para classificacao por LLM na Fase 2b.

### Cuidado

`content` pode conter dados pessoais. Deve ser tratado como sensivel.

## `core.message_attachments`

### Em portugues simples

Essa tabela guarda anexos das mensagens.

Ela nao guarda o arquivo em si. Guarda metadados e URLs de referencia.

### Exemplo

Cliente manda foto do pneu, audio ou localizacao. O anexo aparece aqui.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno do anexo. |
| `environment` | Producao ou teste. |
| `chatwoot_attachment_id` | ID do anexo no Chatwoot. |
| `message_id` | Mensagem a qual o anexo pertence. |
| `conversation_id` | Conversa a qual o anexo pertence. |
| `file_type` | Tipo: imagem, audio, video, arquivo, localizacao etc. |
| `mime_type` | Tipo tecnico do arquivo, como `image/jpeg` ou `audio/ogg`. |
| `file_size_bytes` | Tamanho do arquivo. |
| `duration_ms` | Duracao, para audio/video. |
| `width` | Largura, para imagem/video. |
| `height` | Altura, para imagem/video. |
| `data_url` | URL original do arquivo no Chatwoot. Pode expirar. |
| `thumb_url` | URL da miniatura. |
| `coordinates_lat` | Latitude, se for localizacao. |
| `coordinates_lng` | Longitude, se for localizacao. |
| `transcription_available` | Se ja existe transcricao futura disponivel. |
| `created_at` | Quando a linha foi criada. |

### Que relatorios isso permite

Agora ou futuramente:

- Quantas conversas usam audio.
- Quantos clientes mandam foto.
- Quais canais tem mais midia.
- Separar conversas que precisam de transcricao.
- Futuramente medir impacto de audio em conversao.
- Futuramente ligar transcricao em `analytics.*`.

## `core.conversation_tags`

### Em portugues simples

Essa tabela guarda etiquetas/labels aplicadas nas conversas.

Tags sao como marcadores.

### Exemplo

Uma conversa pode receber tags como:

- `orcamento`
- `pedido_cancelado`
- `oferta_enviada`
- `suporte`

### Campos principais

| Campo | O que significa |
| --- | --- |
| `environment` | Producao ou teste. |
| `conversation_id` | Conversa marcada. |
| `label` | Nome da etiqueta. |
| `added_at` | Quando a etiqueta foi observada. |
| `added_by_type` | Quem adicionou: usuario, sistema, automacao etc. |

### Que relatorios isso permite

Agora ou futuramente:

- Conversas por etiqueta.
- Quantas conversas chegaram a "oferta enviada".
- Quantas conversas viraram "pedido cancelado".
- Funil baseado em tags.
- Comparar tags manuais com classificacoes futuras.

## `core.conversation_status_events`

### Em portugues simples

Essa tabela guarda o historico das mudancas importantes da conversa.

Enquanto `core.conversations` mostra o status atual, esta tabela mostra o caminho.

### Exemplo

Uma conversa pode passar por:

```text
open -> pending -> resolved
```

Cada mudanca pode virar uma linha aqui.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno do evento. |
| `environment` | Producao ou teste. |
| `conversation_id` | Conversa afetada. |
| `chatwoot_conversation_id` | ID da conversa no Chatwoot. |
| `event_type` | Tipo de mudanca: status, label, atribuicao, time, prioridade. |
| `from_value` | Valor antigo. |
| `to_value` | Valor novo. |
| `changed_by_id` | Quem mudou, se conhecido. |
| `changed_by_type` | Tipo de autor: usuario, automacao, API etc. |
| `occurred_at` | Quando aconteceu. |
| `raw_event_id` | Evento bruto que originou essa linha. |
| `created_at` | Quando foi gravado no Farejador. |

### Que relatorios isso permite

Agora ou futuramente:

- Quanto tempo a conversa ficou aberta.
- Quantas vezes mudou de status.
- Quantas conversas foram resolvidas.
- Gargalos de atendimento.
- Funil por transicao.
- Auditoria de quem mudou status ou prioridade.

## `core.conversation_assignments`

### Em portugues simples

Essa tabela guarda quem pegou a conversa e quando.

Ela ajuda a medir handoff: quando uma conversa passa de bot para humano, de um
agente para outro, ou de um time para outro.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno da atribuicao. |
| `environment` | Producao ou teste. |
| `conversation_id` | Conversa atribuida. |
| `agent_id` | Agente que recebeu a conversa. |
| `team_id` | Time responsavel. |
| `assigned_at` | Quando foi atribuida. |
| `unassigned_at` | Quando deixou de estar atribuida. |
| `duration_seconds` | Tempo de duracao da atribuicao, calculado automaticamente. |
| `handoff_number` | Numero do handoff: primeiro, segundo, terceiro etc. |

### Que relatorios isso permite

Agora ou futuramente:

- Quantas conversas cada agente pegou.
- Tempo medio com cada agente.
- Quantos handoffs acontecem antes de resolver.
- Se muitas transferencias atrapalham conversao.
- Carga por time.

## `core.message_reactions`

### Em portugues simples

Essa tabela guarda reacoes/emojis em mensagens.

Hoje ela existe no schema, mas na F1-02 o mapper ainda e placeholder porque os
fixtures principais nao tinham reaction real.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno da reacao. |
| `environment` | Producao ou teste. |
| `message_id` | Mensagem reagida. |
| `reactor_type` | Quem reagiu: contato ou agente. |
| `reactor_id` | ID de quem reagiu. |
| `emoji` | Emoji/reacao. |
| `reacted_at` | Quando reagiu. |
| `removed_at` | Quando removeu a reacao. |

### Que relatorios isso permite

Futuramente:

- Reacoes positivas/negativas em mensagens.
- Engajamento do cliente.
- Sinais de satisfacao.
- Mensagens que geram mais resposta/reacao.

---

# 3. Tabelas de relatorios inteligentes (`analytics`)

Essas tabelas sao para fases futuras.

Aqui entram os dados que nao vieram diretamente do Chatwoot, mas foram calculados,
extraidos ou interpretados.

Exemplos:

- "O cliente pediu pneu 90/90-18."
- "A conversa chegou ate a etapa de orcamento."
- "O motivo de perda foi preco."
- "O cliente demonstrou urgencia."

## `analytics.conversation_facts`

### Em portugues simples

Essa tabela guarda fatos extraidos da conversa.

Um fato e uma informacao importante encontrada no texto ou em algum campo.

### Exemplos de fatos

| Fato | Exemplo |
| --- | --- |
| Produto pedido | pneu 100/80-18 |
| Marca citada | Maggion |
| Preco cotado | R$ 450 |
| Forma de pagamento | Pix |
| Bairro citado | Bras de Pina |
| Motivo mencionado | "achei caro" |

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno do fato. |
| `environment` | Producao ou teste. |
| `conversation_id` | Conversa onde o fato apareceu. |
| `fact_key` | Nome do fato, como `product_asked` ou `price_quoted`. |
| `fact_value` | Valor do fato em JSON. |
| `observed_at` | Quando o fato apareceu. |
| `message_id` | Mensagem onde o fato apareceu. |
| `truth_type` | Se foi observado, inferido, previsto ou corrigido. |
| `source` | Quem gerou: regex, LLM, humano, atributo Chatwoot etc. |
| `confidence_level` | Confianca de 0 a 1. |
| `extractor_version` | Versao da regra, prompt ou extrator. |
| `superseded_by` | Se esse fato foi corrigido por outro. |
| `created_at` | Quando foi criado. |

### Que relatorios isso vai permitir

Futuramente:

- Produtos mais pedidos.
- Medidas de pneu mais procuradas.
- Marcas mais citadas.
- Precos mais cotados.
- Regioes/bairros com mais demanda.
- Formas de pagamento mais mencionadas.
- Motivos mais comuns de duvida ou objecao.

## `analytics.conversation_signals`

### Em portugues simples

Essa tabela guarda metricas calculadas da conversa.

Ela nao tenta "entender" o texto. Ela mede numeros.

### Exemplos de sinais

- Quantas mensagens teve.
- Quanto tempo demorou para responder.
- Quanto tempo a conversa durou.
- Quantas vezes mudou de agente.
- Se teve muita midia.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `conversation_id` | Conversa analisada. |
| `environment` | Producao ou teste. |
| `total_messages` | Total de mensagens. |
| `contact_messages` | Mensagens do cliente. |
| `agent_messages` | Mensagens do agente. |
| `bot_messages` | Mensagens do bot. |
| `media_message_count` | Quantidade de mensagens com midia. |
| `media_text_ratio` | Proporcao entre midia e texto. |
| `first_response_seconds` | Tempo ate primeira resposta. |
| `avg_agent_response_sec` | Tempo medio de resposta do agente. |
| `max_gap_seconds` | Maior intervalo parado na conversa. |
| `total_duration_seconds` | Duracao total da conversa. |
| `handoff_count` | Quantidade de handoffs. |
| `started_hour_local` | Hora local em que comecou. |
| `started_dow_local` | Dia da semana local. |
| `computed_at` | Quando foi calculado. |
| `extractor_version` | Versao do calculo. |
| `source` | Origem, normalmente SQL. |
| `truth_type` | Tipo de verdade, normalmente observado. |
| `confidence_level` | Confianca, normalmente 1.00. |

### Que relatorios isso vai permitir

Futuramente:

- Tempo medio de resposta.
- Conversas mais longas.
- Conversas com maior abandono.
- Horarios de maior volume.
- Dias da semana com mais demanda.
- Quantidade de mensagens antes de resolver.
- Relacao entre demora e perda de venda.

## `analytics.conversation_classifications`

### Em portugues simples

Essa tabela guarda classificacoes de negocio da conversa.

Aqui entra o tipo de coisa que exige interpretacao.

### Exemplos

| Dimensao | Possiveis valores futuros |
| --- | --- |
| `stage_reached` | perguntou preco, recebeu oferta, negociou, fechou |
| `final_outcome` | venda, perda, sem resposta, suporte |
| `loss_reason` | preco, falta de estoque, prazo, concorrente |
| `buyer_intent` | baixo, medio, alto |
| `customer_type` | novo, recorrente, curioso |
| `urgency` | baixa, media, alta |

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno da classificacao. |
| `environment` | Producao ou teste. |
| `conversation_id` | Conversa classificada. |
| `dimension` | Qual aspecto esta sendo classificado. |
| `value` | Valor escolhido para essa classificacao. |
| `truth_type` | Observado, inferido, previsto ou corrigido. |
| `source` | Quem classificou: regra, LLM, humano etc. |
| `confidence_level` | Confianca de 0 a 1. |
| `extractor_version` | Versao do classificador. |
| `notes` | Observacoes. |
| `created_at` | Quando foi criada. |

### Que relatorios isso vai permitir

Futuramente:

- Taxa de conversao por etapa.
- Principais motivos de perda.
- Conversas com alta intencao de compra.
- Quantas vendas foram perdidas por preco.
- Quantas foram perdidas por falta de estoque.
- Comparar desempenho por canal, agente ou horario.

## `analytics.customer_journey`

### Em portugues simples

Essa tabela resume a jornada de cada cliente.

Em vez de olhar conversa por conversa, ela olha o contato ao longo do tempo.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `contact_id` | Cliente/contato analisado. |
| `environment` | Producao ou teste. |
| `total_conversations` | Quantas conversas esse contato teve. |
| `first_conversation_at` | Primeira conversa registrada. |
| `last_conversation_at` | Ultima conversa registrada. |
| `is_returning` | Se e cliente recorrente. |
| `days_since_first` | Dias desde a primeira conversa. |
| `purchase_count` | Quantidade futura de compras via ERP. |
| `partial_ltv_brl` | Valor financeiro acumulado futuro. |
| `last_channel` | Ultimo canal usado. |
| `channel_migration_count` | Quantas vezes mudou de canal. |
| `computed_at` | Quando foi calculado. |
| `extractor_version` | Versao do calculo. |
| `source` | Origem. |
| `truth_type` | Normalmente inferido. |
| `confidence_level` | Confianca. |

### Que relatorios isso vai permitir

Futuramente:

- Clientes recorrentes.
- Clientes que voltaram depois de muitos dias.
- Valor aproximado por cliente.
- Canal preferido do cliente.
- Clientes que migram de Instagram para WhatsApp.
- Base para segmentacao e campanhas.

## `analytics.linguistic_hints`

### Em portugues simples

Essa tabela guarda pistas de linguagem encontradas nas mensagens.

Nao e uma classificacao completa. E um sinal.

### Exemplos de pistas

- "ta caro" -> reclamacao de preco.
- "preciso hoje" -> urgencia.
- "vi mais barato em outro lugar" -> concorrente/preco.
- "???" ou repeticao -> possivel abandono ou ansiedade.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno da pista. |
| `environment` | Producao ou teste. |
| `conversation_id` | Conversa onde apareceu. |
| `message_id` | Mensagem especifica. |
| `hint_type` | Tipo da pista: preco, urgencia, abandono, concorrente etc. |
| `matched_text` | Texto que bateu na regra. |
| `pattern_id` | Regra que encontrou a pista. |
| `truth_type` | Normalmente observado. |
| `source` | Regex ou heuristica usada. |
| `confidence_level` | Confianca. |
| `extractor_version` | Versao da regra. |
| `created_at` | Quando foi criada. |

### Que relatorios isso vai permitir

Futuramente:

- Quantas conversas reclamam de preco.
- Quantas mostram urgencia.
- Concorrentes mais citados.
- Palavras/frases que aparecem antes de perda.
- Sinais textuais que indicam maior chance de compra.

---

# 4. Tabelas operacionais (`ops`)

Estas tabelas ajudam o sistema a operar.

Algumas ja sao uteis na Fase 1. Outras ficam preparadas para fases futuras.

## `ops.stock_snapshots`

### Em portugues simples

Essa tabela vai guardar uma foto do estoque/preco no momento em que o cliente
perguntou.

Ela ainda e futura.

### Exemplo

Cliente perguntou hoje:

> "Quanto esta o pneu X?"

O sistema consulta o ERP e grava:

- preco naquele momento;
- estoque naquele momento;
- promocao naquele momento.

Meses depois, mesmo que o preco mude, ainda sabemos qual era o preco na hora da conversa.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno do snapshot. |
| `environment` | Producao ou teste. |
| `conversation_id` | Conversa relacionada. |
| `message_id` | Mensagem da pergunta. |
| `sku` | Codigo do produto. |
| `product_name` | Nome do produto. |
| `tire_size` | Medida do pneu. |
| `brand` | Marca. |
| `stock_qty` | Quantidade em estoque. |
| `price_brl` | Preco normal. |
| `promo_price_brl` | Preco promocional. |
| `snapshot_at` | Quando o ERP foi consultado. |
| `erp_source` | Qual sistema informou o dado. |
| `raw_payload` | Resposta bruta do ERP. |

### Que relatorios isso vai permitir

Futuramente:

- Vendas perdidas por falta de estoque.
- Produtos mais perguntados.
- Precos cotados no momento da conversa.
- Impacto de promocao na conversao.
- Historico de preco por conversa.

## `ops.enrichment_jobs`

### Em portugues simples

Essa tabela e uma fila de tarefas para trabalhadores de fundo.

Ela responde:

> "O que o sistema ainda precisa processar depois?"

Na Fase 1 ela nao deve ser populada.

### Exemplos de tarefas futuras

- Transcrever audio.
- Fazer OCR de imagem.
- Classificar conversa com LLM.
- Extrair fatos da conversa.
- Buscar preco no ERP.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno do job. |
| `environment` | Producao ou teste. |
| `job_type` | Tipo do trabalho. |
| `target_type` | O que sera processado: mensagem, conversa ou anexo. |
| `target_id` | ID do alvo. |
| `status` | Estado: na fila, rodando, concluido, falhou ou ignorado. |
| `priority` | Prioridade do job. |
| `attempts` | Quantas vezes tentou rodar. |
| `last_error` | Ultimo erro. |
| `scheduled_at` | Quando pode rodar. |
| `started_at` | Quando comecou. |
| `completed_at` | Quando terminou. |
| `result_ref` | Onde ficou o resultado. |
| `worker_id` | Worker que pegou o job. |
| `created_at` | Quando o job foi criado. |

### Que relatorios/controles isso vai permitir

Futuramente:

- Quantos jobs estao pendentes.
- Quantas transcricoes falharam.
- Custo/volume de chamadas LLM.
- Tempo medio de processamento.
- Backlog por tipo de tarefa.

## `ops.bot_events`

### Em portugues simples

Essa tabela vai guardar eventos do futuro agente conversacional.

Na Fase 1 ela fica vazia.

### Exemplos

- O agente chamou uma ferramenta.
- O agente recebeu resultado de uma ferramenta.
- O agente falhou.
- O agente chamou um humano.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno do evento. |
| `environment` | Producao ou teste. |
| `conversation_id` | Conversa relacionada. |
| `message_id` | Mensagem relacionada. |
| `event_type` | Tipo: chamada de ferramenta, erro, fallback, handoff etc. |
| `tool_name` | Nome da ferramenta chamada. |
| `tool_input` | Entrada enviada para a ferramenta. |
| `tool_output` | Resultado da ferramenta. |
| `latency_ms` | Tempo gasto. |
| `error_message` | Erro, se houver. |
| `occurred_at` | Quando aconteceu. |
| `created_at` | Quando foi gravado. |

### Que relatorios isso vai permitir

Futuramente:

- Quantas vezes o bot errou.
- Ferramentas mais usadas.
- Tempo medio das ferramentas.
- Motivos de handoff para humano.
- Qualidade operacional do agente.

## `ops.erasure_log`

### Em portugues simples

Essa tabela guarda o historico de apagamento/anonimizacao LGPD.

Quando um cliente pede para apagar dados pessoais, o sistema precisa registrar:

- quem pediu;
- o que foi apagado;
- quando foi feito;
- quem executou.

### Campos principais

| Campo | O que significa |
| --- | --- |
| `id` | ID interno do log. |
| `environment` | Producao ou teste. |
| `contact_id` | Contato afetado. |
| `chatwoot_contact_id` | ID do contato no Chatwoot. |
| `requested_by` | Quem solicitou. |
| `reason` | Motivo. |
| `fields_anonymized` | Campos anonimizados. |
| `executed_at` | Quando foi executado. |
| `executed_by` | Quem executou. |
| `notes` | Observacoes. |

### Que relatorios/controles isso permite

- Auditoria LGPD.
- Quantas solicitacoes de apagamento aconteceram.
- Quem executou cada acao.
- Quais campos foram anonimizados.

---

# Funcoes importantes

## `ops.anonymize_contact`

### Em portugues simples

Funcao que anonimiza um contato.

Ela limpa dados pessoais em `core.contacts` e registra o ato em `ops.erasure_log`.

### O que ela apaga

- nome;
- telefone;
- email;
- identificador;
- atributos customizados.

## `ops.ensure_monthly_partitions`

### Em portugues simples

Funcao que cria novas "gavetas mensais" para tabelas grandes.

Hoje isso vale para:

- `raw.raw_events`;
- `core.messages`.

Essas tabelas crescem muito, entao sao separadas por mes.

---

# Relatorios futuros que esse banco prepara

## Relatorios operacionais

- Webhooks recebidos por dia.
- Eventos com erro.
- Tempo entre receber webhook e processar.
- Conversas abertas, pendentes e resolvidas.
- Tempo medio de primeira resposta.
- Tempo medio de resolucao.
- Conversas por canal.
- Conversas por agente.

## Relatorios comerciais

- Produtos mais perguntados.
- Medidas de pneu mais procuradas.
- Marcas mais citadas.
- Cotacoes por periodo.
- Conversas que chegaram ate oferta.
- Motivos de perda.
- Conversas com maior intencao de compra.
- Impacto de demora na conversao.

## Relatorios de atendimento

- Volume por agente.
- Handoffs por conversa.
- Tempo com cada agente.
- Mensagens antes de resolver.
- Conversas com reclamacao de preco.
- Conversas com urgencia.
- Clientes que mandam audio/foto.

## Relatorios de cliente

- Clientes recorrentes.
- Clientes novos por canal.
- Jornada do cliente.
- Mudanca de canal, por exemplo Instagram -> WhatsApp.
- Futuro valor por cliente via ERP.

## Relatorios de qualidade e IA

- Quantidade de jobs LLM/transcricao.
- Falhas de jobs.
- Classificacoes corrigidas.
- Confianca das classificacoes.
- Comparacao entre regra deterministica e LLM.

---

# Ordem recomendada para estudar

1. `raw.delivery_seen`
2. `raw.raw_events`
3. `core.contacts`
4. `core.conversations`
5. `core.messages`
6. `core.message_attachments`
7. `core.conversation_tags`
8. `core.conversation_status_events`
9. `core.conversation_assignments`
10. `analytics.conversation_signals`
11. `analytics.conversation_facts`
12. `analytics.conversation_classifications`
13. `ops.enrichment_jobs`
14. `ops.erasure_log`

Se voce entender estas tres frases, entendeu a espinha dorsal:

```text
raw guarda o que chegou.
core organiza o que aconteceu.
analytics explica o que isso significa.
```
