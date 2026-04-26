# Guia de implementacao F2a para Kimi

Atualizado: 25/04/2026

## Antes de qualquer tarefa

Ler obrigatoriamente:

- `docs/KIMI_RULES.md`
- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/F2A_ARCHITECTURE.md`
- `docs/phases/PHASE_02A.md`
- o arquivo da task atual em `docs/tasks/`

## Regra mais importante

F2a escreve somente em `analytics.*`.

Proibido:

- escrever em `raw.*`;
- escrever em `core.*`;
- chamar LLM;
- criar agente conversacional;
- colocar regra de pneu no nucleo generico;
- alterar migrations antigas.

## Como acessar Supabase em tarefas que precisem de banco real

Nunca commitar credenciais. Nunca colar secrets em docs, testes ou fixtures.

Use uma destas formas:

### Opcao A - `.env.codex` local

Wallace/Codex podem fornecer um arquivo local nao versionado:

```text
.env.codex
```

Ele deve ficar fora do git. Confirmar com:

```powershell
git status --short
```

Se `.env.codex` aparecer como arquivo novo, parar e avisar. Nao commitar.

### Opcao B - variaveis no terminal

No PowerShell:

```powershell
$env:DATABASE_URL="postgresql://..."
$env:FAREJADOR_ENV="test"
$env:DATABASE_SSL="true"
$env:DATABASE_CA_CERT=""
```

Para teste real, usar `FAREJADOR_ENV=test` sempre que a task nao pedir prod
explicitamente.

### Opcao C - sem credenciais

Se nao houver credenciais, nao inventar. Rodar apenas:

```powershell
npm run typecheck
npm test
npm run build
```

E registrar em "Pendencias":

```text
Validacao Supabase real nao executada: DATABASE_URL nao disponivel nesta sessao.
```

## Comandos de validacao

Sempre rodar:

```powershell
npm run typecheck
npm test
npm run build
```

Quando houver teste real com Supabase:

- usar `environment=test`;
- criar dados com IDs altos e prefixo claro;
- limpar somente dados criados pela propria task;
- nunca apagar dados prod.

## Padrao de entrega para Kimi

Entregar no formato de `docs/KIMI_RULES.md`:

- Arquivos alterados;
- Checklist;
- Pendencias;
- Riscos.

Adicionar tambem:

```text
Validacao executada:
- npm run typecheck -> ...
- npm test -> ...
- npm run build -> ...
- Supabase real -> executado / nao executado
```

## Como nao passar da fronteira do fork

Antes de qualquer arquivo em `segments/tires`, parar e avisar.

Permitido antes do fork:

- `src/enrichment/*`;
- `segments/generic/*`;
- `segments/_template/*`;
- `segments/routing.json`;
- testes de motor generico;
- classificacoes genericas;
- docs da F2a.

Proibido antes do fork:

- `segments/tires/*`;
- regra com palavras de pneu no nucleo;
- classificacao exclusiva de venda de pneu dentro de `src/enrichment/*`.

## Roteamento de segmento

O segmento deve ser escolhido por `segments/routing.json`, usando
`environment + chatwoot_account_id`.

Nao escolher segmento analisando o texto da conversa.

Antes da tag `farejador-base-v1`, a conta real deve continuar apontando para
`generic`. Depois da tag, a F2A-05 pode criar `segments/tires` e mudar a rota.

## Ordem das tarefas F2a

1. F2A-01 - signals + CLI minimo.
2. F2A-02 - regras genericas + routing + `_template` + UNIQUE de hints.
3. F2A-03 - classificacoes genericas.
4. F2A-04 - fronteira do fork.
5. F2A-05 - pacote pneus, somente depois da tag/base.
