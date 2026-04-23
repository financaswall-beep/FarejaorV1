# CONTRACTS — Tipos compartilhados entre módulos

Contratos são tipos TypeScript + schemas Zod usados por mais de um módulo. Ficam em
`src/shared/types/`. Sua estabilidade é a razão de existir — se mudam toda hora,
não servem pra nada.

## Regras

1. Tipos em `src/shared/types/` **só podem ser alterados mediante task explícita**.
2. Não adicione campos opcionais "por precaução". Adicione quando tiver caller real.
3. Toda interface cruzando fronteira de módulo (webhook → persistence, normalizer →
   repository) deve usar tipos desse diretório.
4. Validação de entrada externa (payload do Chatwoot, body de request) usa **Zod**,
   não type assertions.
5. Nunca use `any`. Se precisa receber estrutura desconhecida, use `unknown` e
   estreite com Zod no ponto de entrada.

## Contratos existentes

### `src/shared/types/chatwoot.ts`
Schemas Zod e tipos inferidos para os payloads de webhook do Chatwoot:

- `environmentSchema` — `'prod' | 'test'`
- `chatwootEventTypeSchema` — enum dos 7 event types do MVP
- `chatwootContactSchema` — entidade contato
- `chatwootConversationSchema` — entidade conversa
- `chatwootMessageSchema` — entidade mensagem
- `chatwootAttachmentSchema` — entidade anexo
- `chatwootWebhookEnvelopeSchema` — envelope mínimo com `event` obrigatório

Esses schemas usam `.passthrough()` — campos desconhecidos passam sem falhar,
porque o Chatwoot envia mais do que usamos.

## Como adicionar um contrato novo

1. Abra uma task explícita (ex: `F1-XX-add-contract-Y.md`).
2. O arquivo vai em `src/shared/types/<nome>.ts`.
3. Exporte `schema` (Zod) + `type` (inferido).
4. Documente aqui em `CONTRACTS.md` na seção acima.
5. Commit separado, review focado apenas no contrato antes de qualquer task consumi-lo.

## O que NÃO é contrato compartilhado

- Tipos internos a um módulo (ex: estado de máquina dentro de `normalization/`).
  Esses ficam junto do código que os usa.
- Tipos derivados do schema do banco. Para isso, use `pg` + type generation futura.
- DTOs de endpoints admin. Ficam em `src/admin/`.
