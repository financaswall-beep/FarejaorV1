# Testes - Farejador

Este diretorio contem a infraestrutura de testes entregue na **F1-04** e os testes
unitarios adicionados para a **F1-01**.

## O que esta aqui

| Arquivo / Diretorio | Proposito |
|---|---|
| `vitest.config.ts` | Configuracao do Vitest (raiz do projeto). |
| `tests/fixtures/chatwoot/*.json` | 8 fixtures JSON: um para cada `event_type` suportado no MVP, mais uma mensagem com attachment. |
| `tests/helpers/hmac.ts` | Geracao de assinaturas HMAC para testes do webhook handler. |
| `tests/helpers/db.ts` | Esqueleto de setup/teardown de banco; sem conexao real nesta entrega. |
| `tests/unit/shared/types/chatwoot.test.ts` | Valida que cada fixture passa pelo `chatwootWebhookEnvelopeSchema`. |
| `tests/unit/webhooks/*.test.ts` | Valida HMAC/timestamp e fluxo do webhook handler com `pg` mockado. |

## O que nao esta aqui (escopo adiado)

- Testes dos mappers de normalizacao -> **F1-02**
- Testes de deduplicacao com banco real -> pendente de Postgres/Supabase com migrations aplicadas
- Testes de watermark com banco real -> **F1-02**

Os testes de handler existentes usam `pg` mockado e nao substituem a validacao end-to-end
contra Postgres real.

## Como rodar

```bash
npm test
```

Criterio de aceite local: todos os testes existentes passam (verde).

## Dados sensiveis

As fixtures usam placeholders (`TEST NAME`, `test+N@example.com`, telefones de teste e URLs `example.test`).
Nao devem conter PII real.
