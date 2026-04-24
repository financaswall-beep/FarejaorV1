# Testes — F1-04

Este diretório contém a infraestrutura de testes entregue na **F1-04**.

## O que está aqui

| Arquivo / Diretório | Propósito |
|---|---|
| `vitest.config.ts` | Configuração do Vitest (raiz do projeto). |
| `tests/fixtures/chatwoot/*.json` | 7 fixtures JSON, um para cada `event_type` suportado no MVP. |
| `tests/helpers/hmac.ts` | Geração de assinaturas HMAC para testes futuros do webhook handler. |
| `tests/helpers/db.ts` | Esqueleto de setup/teardown de banco; sem conexão real nesta entrega. |
| `tests/unit/shared/types/chatwoot.test.ts` | Valida que cada fixture passa pelo `chatwootWebhookEnvelopeSchema`. |

## O que NÃO está aqui (escopo adiado)

- Testes do webhook handler → **F1-01**
- Testes dos mappers de normalização → **F1-02**
- Testes de deduplicação com banco → **F1-01**
- Testes de watermark com banco → **F1-02**

Esses testes serão escritos junto com a implementação de produção nas respectivas tasks.

## Como rodar

```bash
npm test
```

Critério de aceite da F1-04: todos os testes existentes passam (verde).
