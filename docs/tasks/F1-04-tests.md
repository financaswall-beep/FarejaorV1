# F1-04 — Fixtures + infraestrutura de testes

## Objetivo
Criar a infraestrutura compartilhada de testes: fixtures JSON reais do Chatwoot,
configuração do Vitest e helpers reutilizáveis. Validar que cada fixture passa pelo
contrato Zod em `src/shared/types/chatwoot.ts`.

> **Nota de escopo (decisão de design):**
> F1-04 entrega APENAS a infraestrutura de testes e fixtures.
> Os testes do webhook handler ficam em F1-01 (junto com a implementação).
> Os testes dos mappers e de dedup/watermark ficam em F1-02 (junto com a implementação).
> Essa separação evita o chicken-and-egg de testar código que ainda não existe.

## Escopo

**Inclui:**
- Fixtures JSON em `tests/fixtures/chatwoot/` — um arquivo por event_type coberto no MVP
- Setup do Vitest (`vitest.config.ts`)
- Helper `tests/helpers/hmac.ts` — gera `X-Chatwoot-Signature` válida para testes
- Helper `tests/helpers/db.ts` — setup/teardown do DB de teste (esqueleto; conexão real
  usada em F1-01 e F1-02)
- `tests/README.md` — como rodar os testes, como configurar `.env.test`
- Testes de contrato Zod: cada fixture deve passar pelo `chatwootWebhookEnvelopeSchema`

**Não inclui:**
- Testes do webhook handler (F1-01 escreve junto com a implementação)
- Testes dos mappers (F1-02 escreve junto com a implementação)
- Testes de dedup end-to-end com DB (F1-01)
- Testes de watermark com DB (F1-02)
- Cobertura 100%
- Testes de performance
- Testes dos endpoints admin (F1-03)

## Arquivos que pode criar/editar

- `vitest.config.ts`
- `tests/fixtures/chatwoot/contact_created.json`
- `tests/fixtures/chatwoot/contact_updated.json`
- `tests/fixtures/chatwoot/conversation_created.json`
- `tests/fixtures/chatwoot/conversation_updated.json`
- `tests/fixtures/chatwoot/conversation_status_changed.json`
- `tests/fixtures/chatwoot/message_created.json`
- `tests/fixtures/chatwoot/message_updated.json`
- `tests/fixtures/chatwoot/message_with_attachment.json`
- `tests/helpers/db.ts` (setup/teardown de schema de teste)
- `tests/helpers/hmac.ts` (gera assinatura válida para testes)
- `tests/README.md`
- Arquivos `*.test.ts` ao lado dos módulos correspondentes

## Arquivos que NÃO deve mexer

- `src/shared/types/chatwoot.ts` (importar, nunca alterar)
- `db/migrations/**`
- Código de produção de `src/` (exceto criar `*.test.ts` adjacentes)
- `package.json` (se precisar `vitest`, `@types/supertest`, está autorizado; qualquer
  outra lib, pergunta)

## Regras específicas

1. **Fixtures devem ser reais**, não inventadas. Extrair de:
   - Schema legado (sessao_chat, mensagem_chat) se tiver payload guardado, ou
   - Staging do Chatwoot do usuário fazendo eventos de teste, ou
   - Documentação oficial do Chatwoot como último recurso (marcar como `-SYNTHETIC`
     no nome do arquivo se for este caso)
2. **Fixtures sem PII real**. Trocar telefones reais por `+55 21 99999-XXXX`,
   nomes por `TEST NAME N`, emails por `test+N@example.com`. Documentar em `README.md`
   do diretório.
3. **Teste de DB usa schema separado** (`test_*` ou database dedicado), nunca toca
   em `prod` ou `test` de produção.
4. **Cada teste deve ser independente**. Limpeza em `beforeEach` ou transações que
   fazem rollback.
5. **Não mockar o banco**. Usar Postgres real (pode ser container Docker local).
   Mockar só APIs externas (Chatwoot API no teste do reconcile).
6. **Assinatura HMAC nos testes**: helper em `tests/helpers/hmac.ts` que gera
   `X-Chatwoot-Signature` a partir do body. Usar mesma lib do runtime (`node:crypto`).

## Casos de teste desta task

### Contrato Zod (sem DB, sem implementação)
- [ ] `contact_created.json` passa por `chatwootWebhookEnvelopeSchema`
- [ ] `contact_updated.json` passa por `chatwootWebhookEnvelopeSchema`
- [ ] `conversation_created.json` passa por `chatwootWebhookEnvelopeSchema`
- [ ] `conversation_updated.json` passa por `chatwootWebhookEnvelopeSchema`
- [ ] `conversation_status_changed.json` passa por `chatwootWebhookEnvelopeSchema`
- [ ] `message_created.json` passa por `chatwootWebhookEnvelopeSchema`
- [ ] `message_updated.json` passa por `chatwootWebhookEnvelopeSchema`
- [ ] `message_with_attachment.json` passa por `chatwootWebhookEnvelopeSchema`
- [ ] JSON sem campo `event` falha o parse (erro Zod esperado)

> Testes de handler, mapper, dedup e watermark são escritos em F1-01 e F1-02.

## Scripts `package.json` esperados

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run --project unit",
  "test:integration": "vitest run --project integration"
}
```

(Pode ser mais simples no MVP — tudo em um `vitest run` também serve, desde que
testes de DB marcados com suíte separada.)

## Checklist

- [ ] `vitest.config.ts` configurado
- [ ] Diretório `tests/fixtures/chatwoot/` com 8 arquivos JSON (7 event_types + 1 com attachment)
- [ ] Fixtures auditadas: sem PII real (telefone, email, nome trocados por placeholders)
- [ ] Fixtures sintéticas marcadas com sufixo `-SYNTHETIC` se baseadas em docs (não em dados reais)
- [ ] `tests/helpers/hmac.ts` gerando assinatura HMAC-SHA256 via `node:crypto`
- [ ] `tests/helpers/db.ts` com esqueleto de setup/teardown (conexão real implementada em F1-01)
- [ ] `tests/README.md` explicando como rodar + como configurar `.env.test`
- [ ] Todos os 9 testes de contrato Zod passando
- [ ] `npm test` verde sem warnings

## Critérios de aceite

1. `npm test` verde em máquina nova após `npm install` (sem precisar de DB).
2. Nenhum teste toca DB ou internet.
3. Todas as 8 fixtures passam pelo `chatwootWebhookEnvelopeSchema`.
4. Fixture sem campo `event` falha o parse com erro Zod.

## Formato obrigatório de resposta

Mesmo formato de F1-01 (arquivos / checklist / pendências / riscos).
