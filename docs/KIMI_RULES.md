# KIMI_RULES — Regras obrigatórias de execução

Este documento é o contrato de operação do executor (Kimi K2). **Deve ser anexado no
início de todo prompt de tarefa.** Violação de qualquer regra bloqueia o merge.

## Regras inegociáveis

1. **Execute apenas a tarefa nomeada.** Não expanda escopo. Não refatore fora do que
   está listado no arquivo da task.
2. **Não crie arquivos fora dos listados** no campo "Arquivos que pode mexer" da task.
   Se sentir falta de um novo arquivo, pare e pergunte — não crie por conta própria.
3. **Não altere migrations já aprovadas** (`db/migrations/00XX_*.sql`). Nova migration
   só mediante task explícita.
4. **Não altere contratos em `src/shared/types/`** sem autorização explícita. Esses
   tipos são compartilhados entre tasks e seu valor é justamente a estabilidade.
5. **Não introduza dependências novas** em `package.json` sem autorização.
6. **LLM nunca escreve em `raw.*` ou `core.*`.** Se a task envolve LLM (fases 2b/3), as
   escritas só podem ir em `analytics.*`. Fase 1 não usa LLM no runtime.
7. **Webhook responde rápido.** Persistência pesada e normalização rodam async.
   Nenhum `await` em I/O bloqueante na request antes do 2xx.
8. **Respostas de erro nunca vazam payload do Chatwoot** nem PII do cliente em logs.
9. **Código em inglês.** Nomes de variáveis, funções, arquivos, comentários em inglês.
   Strings voltadas ao usuário final e mensagens de erro podem ser em pt-BR.
10. **Sempre responder no formato obrigatório** descrito abaixo.

## Diretrizes de estilo

- Prefira a solução mais simples que funciona.
- Não crie abstração antes de haver segundo caller real.
- Não crie camada de indireção só porque "um dia pode precisar".
- Evite `any`. Use `unknown` e estreite com Zod quando vier de fora.
- Funções puras sempre que possível. I/O isolado nos repositories.
- Um arquivo, uma responsabilidade.

## Quando houver dúvida

1. **Pare.**
2. Releia a task.
3. Se ainda houver ambiguidade, escreva a dúvida na seção "Pendências" da resposta e
   escolha a opção mais conservadora.
4. **Nunca invente.** Ambiguidade não resolvida = pergunta, não palpite.

## Formato obrigatório de resposta

Toda entrega deve voltar exatamente nesta estrutura:

```markdown
## Arquivos alterados
- caminho/do/arquivo1.ts  (criado | modificado)
- caminho/do/arquivo2.ts  (criado | modificado)

## Checklist
- [x] item concluído do checklist da task
- [x] outro item concluído
- [ ] item que ficou pendente (com motivo)

## Pendências
- descrição curta do que ficou faltando
- dúvidas de ambiguidade na task
- itens que dependem de decisão externa

## Riscos
- risco identificado e sugestão de mitigação
- caso de borda que não foi testado
- suposição feita que precisa de validação
```

Se qualquer bloco não se aplica, escreva explicitamente "nenhum" em vez de omitir.

## O que cancela uma entrega automaticamente

- Arquivos alterados fora da lista permitida → **rejeitado, revert**
- Dependência nova em `package.json` sem autorização → **rejeitado**
- Migration alterada sem task → **rejeitado**
- Resposta sem o formato obrigatório → **rejeitado, refazer**
- LLM escrevendo em `raw` ou `core` → **rejeitado, redesenhar**
