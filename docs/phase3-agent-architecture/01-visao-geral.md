# 01 - Visao Geral

## Frase central

A Organizadora entende. A Atendente age. O Commerce informa. O codigo valida.

## Fluxo macro

A arquitetura tem **dois caminhos paralelos** com latencias diferentes, nao um unico fluxo sequencial.

### Caminho 1 - tempo real (Atendente responde)

```text
Cliente manda mensagem no Chatwoot
        ↓
Farejador API recebe webhook
        ↓
valida HMAC, grava raw.* e core.*
        ↓
enfileira job em ops.atendente_jobs e ops.enrichment_jobs
        ↓
responde 200 rapido ao Chatwoot
        ↓
Atendente Worker consome job
        ↓
Context Builder monta pacote pequeno (le agent.*, analytics.*, commerce.*)
        ↓
Planner constrained escolhe skill conversacional a partir do estado reentrante
        ↓
LLM Atendente gera { say, actions }
        ↓
Say Validator + Action Validator
        ↓
Action Handlers gravam agent.* e postam resposta no Chatwoot via API
```

### Caminho 2 - async (Organizadora interpreta)

```text
ops.enrichment_jobs (debounce 60-120s ou status=closed)
        ↓
Organizadora Worker consome job
        ↓
le core.messages e agent.pending_confirmations resolvidas
        ↓
LLM Organizadora extrai fatos com evidencia
        ↓
grava analytics.* (append-only)
```

### Por que paralelo

A Atendente **nao depende** da Organizadora pra responder o turno atual. Ela usa facts ja existentes de turnos anteriores.

A Organizadora melhora a **proxima** interacao, nao a atual.

Isso desacopla latencia da LLM lenta da resposta ao cliente.

## Dois tipos de LLM

### LLM Organizadora

Backstage. Nao fala com cliente.

Responsabilidades:

- extrair fatos da conversa;
- detectar pistas textuais;
- classificar etapa, intencao, urgencia e motivo de perda;
- escrever somente em `analytics.*`;
- sempre usar evidencia.

Nao pode:

- responder cliente;
- escrever em `raw.*` ou `core.*`;
- mexer em preco, estoque, pedido ou carrinho;
- inventar chaves fora do schema do segmento.

### LLM Atendente

Atendimento ao cliente. Conversa via Chatwoot.

Responsabilidades:

- receber contexto pronto;
- usar skills;
- responder com naturalidade;
- propor acoes estruturadas;
- respeitar limites de preco, estoque, pedido e politica.

Nao pode:

- escrever direto no banco;
- inventar preco ou estoque;
- criar pedido sem confirmacao;
- reescrever fatos em `analytics.*`;
- apagar ou corrigir `core.*`.

## Modo inicial: Shadow Assistido

Antes de ligar a LLM Atendente, o sistema deve operar por aproximadamente 5 semanas em modo Shadow Assistido.

Nesse modo:

- Wallace atende manualmente no Chatwoot;
- Farejador continua gravando `raw.*` e `core.*`;
- LLM Organizadora interpreta as conversas e grava `analytics.*`;
- LLM Atendente fica desligada;
- os dados reais calibram skills, prompts, fact_keys e dashboards.

Com media de 100 conversas novas por dia, esse periodo deve gerar cerca de 3.500 conversas reais.

O objetivo e ligar a Atendente depois com base em dados reais da loja.

## Possivel terceira LLM futura

A arquitetura deixa espaco para uma LLM Supervisora no futuro.

Ela seria uma auditora de qualidade, nao uma vendedora:

- revisa conversas perdidas;
- analisa respostas ruins;
- sugere melhorias de skill;
- identifica oportunidades;
- roda em batch, fora do tempo real.

Nao entra no v1.

## Funil como mapa, nao escada

O agente nao segue um fluxo linear.

Cliente pode:

- entrar pelo topo: "tem pneu de moto?";
- entrar pelo fundo: "quero Maggion 100/80-17 entrega hoje";
- voltar para o topo: "na verdade e outra moto";
- pular para objecao: "achei caro";
- pedir humano a qualquer momento.

Na v1 reentrante, o Planner constrained decide a proxima skill olhando:

- estado consolidado;
- mensagem atual;
- hints fortes da mensagem atual;
- carrinho;
- disponibilidade de dados.

O Planner e read-only: ele nao muda estado. Mutacao continua passando por
`actions` validadas e action handlers. O contrato atual do estado esta em
[21 - Atendente v1: State Design](21-atendente-v1-state-design.md).
