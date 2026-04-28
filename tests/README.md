# Testes - Farejador

Este diretorio contem a infraestrutura de testes entregue na **F1-04** e os testes
unitarios adicionados para a **F1-01**, **F1-02** e **F2A**.

## O que esta aqui

| Arquivo / Diretorio | Proposito |
|---|---|
| `vitest.config.ts` | Configuracao do Vitest (raiz do projeto). |
| `tests/fixtures/chatwoot/*.json` | 8 fixtures JSON: um para cada `event_type` suportado no MVP, mais uma mensagem com attachment. |
| `tests/helpers/hmac.ts` | Geracao de assinaturas HMAC para testes do webhook handler. |
| `tests/unit/shared/types/chatwoot.test.ts` | Valida que cada fixture passa pelo `chatwootWebhookEnvelopeSchema`. |
| `tests/integration/*.test.ts` | Testes de integracao com Postgres real via Testcontainers. |
| `tests/unit/webhooks/*.test.ts` | Valida HMAC/timestamp e fluxo do webhook handler com `pg` mockado. |
| `tests/unit/normalization/*.test.ts` | Testes de mappers de normalizacao (contact, message, conversation, attachment, status, assignment, tag, reaction). |
| `tests/unit/persistence/*.test.ts` | Testes de repositories com `pg` mockado (upserts, watermarks, dedup). |

## O que nao esta aqui (escopo adiado)

- Nada. Testes de integracao com banco real estao em `tests/integration/`.

## Como rodar

```bash
npm test
```

Criterio de aceite local: todos os testes existentes passam (verde). Estado atual: 192 testes.

## Dados sensiveis

As fixtures usam placeholders (`TEST NAME`, `test+N@example.com`, telefones de teste e URLs `example.test`).
Nao devem conter PII real.
