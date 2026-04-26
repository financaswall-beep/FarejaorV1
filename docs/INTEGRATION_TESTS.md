# Testes de integracao com Postgres real

## Objetivo

Esses testes existem para pegar problemas que mocks de `pg` nao pegam:

- triggers;
- constraints;
- migrations em ordem;
- idempotencia real;
- comportamento de `ON CONFLICT`;
- diferencas entre SQL aceito em string e SQL aceito pelo Postgres.

## Como roda

```powershell
npm run test:integration
```

Requisito local:

```text
Docker Desktop rodando
```

Os testes usam Testcontainers para subir um `postgres:16-alpine`, aplicar todas as
migrations de `db/migrations/*.sql` em ordem e depois executar as validacoes.

## CI

O workflow `.github/workflows/ci.yml` roda:

```text
npm run typecheck
npm test
npm run test:integration
npm run build
```

No GitHub Actions, Docker ja vem disponivel no runner `ubuntu-latest`, entao o
harness roda sem depender do Docker local da maquina do Wallace.

## Cobertura inicial

- `raw.raw_events` bloqueia `DELETE`;
- `raw.raw_events` bloqueia update de `payload` e `event_type`;
- `raw.raw_events` permite atualizar campos operacionais;
- constraints de dedup em status events e assignments;
- `analytics.linguistic_hints.hint_type` aceita tipos de segmento apos migration 0011;
- `hints_dedup_key` continua ativo;
- `analytics.conversation_classifications` permite historico por `ruleset_hash`;
- `classifications_dedup_key` bloqueia duplicata com o mesmo hash.

## Observacao local

Em 26/04/2026, a maquina local nao tinha Docker instalado. Por isso, a validacao
local executada foi:

```text
npm run typecheck
npm test
npm run build
```

Resultado: verde, `192/192` testes unitarios.

O harness de integracao esta pronto para CI e para execucao local futura quando
Docker Desktop estiver instalado.
