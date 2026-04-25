# Relatorio operacional - Chatwoot conectado ao Farejador

Atualizado: 25/04/2026

## Resumo executivo

O Farejador foi publicado no Coolify, conectado ao Supabase e recebeu webhooks reais
do Chatwoot. A integracao basica esta funcionando:

- `GET /healthz` responde `{"status":"ok","environment":"prod"}`.
- O endpoint `POST /webhooks/chatwoot` aceita assinatura HMAC oficial do Chatwoot.
- Eventos reais foram persistidos em `raw.raw_events`.
- O worker de normalizacao esta processando a fila para `core.*`.

Ainda nao estamos em producao plena. Estamos em **shadow mode controlado**.

## Onde estamos no projeto

Fase atual: fim da Fase 1, validacao operacional real.

Concluido:

- F1-01 webhook ingestion.
- F1-02 normalizacao deterministica.
- F1-03 admin endpoints e reconcile.
- Deploy Coolify do Farejador.
- Conexao com Supabase via Supabase Connection Pooler.
- Teste real de webhook Chatwoot -> Farejador.

Pendente antes de considerar Fase 1 fechada:

- Controlar ruido de `message_updated` antes de religar webhook da inbox API.
- Drenar/limpar a fila gerada durante o teste.
- Validar replay real sem duplicar `core.*`.
- Validar reconcile real em janela pequena.
- Rodar shadow mode com eventos reais por periodo combinado.

## Acesso e endpoints

Chatwoot:

```text
http://76.13.164.152/app/accounts/1/dashboard
```

Account ID:

```text
1
```

API base URL:

```text
http://76.13.164.152/api/v1
```

Farejador:

```text
http://76.13.164.152:3000
```

Health:

```text
http://76.13.164.152:3000/healthz
```

Webhook:

```text
http://76.13.164.152:3000/webhooks/chatwoot
```

Repositorio:

```text
https://github.com/financaswall-beep/FarejaorV1
```

Ultimos commits relevantes:

```text
c83b398 fix: validate official Chatwoot webhook signature
f110ed0 fix: install build dependencies in Docker builder
935f323 chore: add Coolify deploy config
```

## Variaveis importantes no Coolify/Farejador

Nao registrar valores secretos em logs ou docs.

Configuracao esperada:

```env
NODE_ENV=production
FAREJADOR_ENV=prod
PORT=3000
LOG_LEVEL=info
DATABASE_URL=<Supabase Connection Pooler Session Mode>
DATABASE_POOL_MAX=10
DATABASE_SSL=true
CHATWOOT_HMAC_SECRET=<secret da inbox/webhook Chatwoot>
CHATWOOT_WEBHOOK_MAX_AGE_SECONDS=300
CHATWOOT_API_BASE_URL=http://76.13.164.152/api/v1
CHATWOOT_API_TOKEN=<token de acesso Chatwoot>
CHATWOOT_ACCOUNT_ID=1
ADMIN_AUTH_TOKEN=<token admin Farejador>
```

Observacao: usar Connection Pooler do Supabase. A URL direta
`db.<project>.supabase.co:5432` falhou no Coolify por conectividade IPv4/IPv6.

## O que aconteceu no teste real

1. Farejador subiu no Coolify.
2. `/healthz` inicialmente retornou `database_unavailable`.
3. Causa: `DATABASE_URL` direta do Supabase.
4. Correcao: trocar para Supabase Connection Pooler Session Mode.
5. `/healthz` passou a responder `ok`.
6. Criada inbox API no Chatwoot:

```text
Farejador Teste
```

7. Configurada URL de webhook da inbox:

```text
http://76.13.164.152:3000/webhooks/chatwoot
```

8. Primeiro teste real nao caiu no raw porque havia divergencia de HMAC:
   o Farejador validava `raw_body`, mas o Chatwoot assina `timestamp.raw_body`.
9. Correcao aplicada no commit `c83b398`.
10. Depois do redeploy, webhook real entrou em `raw.raw_events`.

Mensagem real enviada para teste:

```text
Teste Farejador webhook real apos fix HMAC 2026-04-24 21:31:08
```

Evento confirmado em `raw.raw_events`:

```text
event_type: message_created
payload_id: 4
processing_status: pending
```

## Problema encontrado: enxurrada de message_updated

A inbox API do Chatwoot reenviou muitos eventos `message_updated` da mensagem de teste
antiga. Como a inbox API nao mostrou selecao granular de eventos na tela, ela enviou
eventos demais para o shadow mode inicial.

Contagem observada:

```text
antes de apagar webhook da inbox:
pending: 1318
processed: 84

depois de apagar webhook da inbox:
pending: 1094
processed: 308

20 segundos depois:
pending: 1069
processed: 333
```

Conclusao:

- A enxurrada parou quando a URL do webhook foi removida da inbox.
- O worker esta drenando a fila.
- O problema nao e conexao; e volume/ruido operacional de `message_updated`.

## Estado atual do webhook no Chatwoot

A URL do webhook da inbox API foi removida temporariamente para parar a fila.

Nao religar ainda:

```text
http://76.13.164.152:3000/webhooks/chatwoot
```

Religar somente depois de implementar protecao contra `message_updated` ruidoso.

## Recomendacao para o proximo passo

Antes de religar o webhook:

1. Adicionar uma regra de shadow mode para `message_updated`.
2. Opcoes aceitaveis:
   - ignorar `message_updated` temporariamente via configuracao;
   - ou deduplicar por chave semantica `(environment, event_type, message_id, updated_at/content hash)`;
   - ou aceitar somente `message_created` enquanto o projeto esta em shadow mode.
3. Atualizar docs e testes.
4. Drenar/limpar fila de teste gerada.
5. Reativar webhook com cuidado.
6. Enviar uma unica mensagem nova e confirmar `raw` + `core`.

## Prompt para Kimi

Leia e obedeca `docs/KIMI_RULES.md`.

Leia tambem:

- `docs/PROJECT.md`
- `docs/HANDOFF.md`
- `docs/CHATWOOT_SHADOW_MODE_REPORT.md`
- `docs/tasks/F1-03-admin.md`

Tarefa proposta:

```text
Investigar e propor uma correcao simples para o ruido de `message_updated` durante
shadow mode. Nao implementar sem aprovacao.

Escopo:
- Ler `src/webhooks/**`, `src/normalization/**`, `src/persistence/raw-events.repository.ts`.
- Confirmar onde e melhor filtrar/deduplicar `message_updated`.
- Nao alterar migrations.
- Nao alterar contratos em `src/shared/types/chatwoot.ts`.
- Nao adicionar dependencias.
- Nao tocar em secrets.

Entrega:
- Relatorio curto com 2 ou 3 opcoes.
- Riscos de cada opcao.
- Recomendacao final.
```

## Pedido para Opus

Auditar a estrategia antes de implementar:

```text
Contexto: Farejador ja recebe webhooks reais do Chatwoot. O HMAC oficial foi corrigido
para `timestamp.raw_body`. Ao religar a inbox API, o Chatwoot reenviou centenas de
`message_updated` repetidos, gerando fila pending alta. A URL do webhook foi removida
temporariamente da inbox.

Pergunta: qual e a menor correcao segura para shadow mode?

Opcoes em avaliacao:
1. Ignorar `message_updated` temporariamente por configuracao.
2. Deduplicar semanticamente `message_updated`.
3. Manter tudo e aumentar throughput do worker.

Favor avaliar risco, impacto em dados e recomendacao.
```

## Riscos atuais

- Secrets foram manipulados durante configuracao manual. Antes de producao plena,
  rotacionar `CHATWOOT_API_TOKEN`, `CHATWOOT_HMAC_SECRET`, `ADMIN_AUTH_TOKEN` e senha
  do banco se necessario.
- A fila de teste contem muitos eventos `message_updated` redundantes.
- A inbox API pode nao permitir selecao granular de eventos no painel.
- Ainda falta teste real de replay e reconcile.

## Veredito

O projeto avancou para shadow mode real. A conexao Chatwoot -> Farejador -> Supabase
esta comprovada. O proximo trabalho nao e conectar; e controlar volume/ruido antes de
religar o webhook da inbox.
