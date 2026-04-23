# REVIEW_PROTOCOL — Fluxo de entrega e revisão

Protocolo operacional entre dono do projeto, executor (Kimi K2) e revisores (Claude / GPT).

## Fluxo por task

```
1. Dono abre task (docs/tasks/F1-XX-*.md já existe).
2. Kimi cria branch: feature/F1-XX-<slug>
3. Kimi executa SOMENTE o escopo da task.
4. Kimi faz commit(s) locais na branch.
5. Kimi entrega:
   - git diff main...feature/F1-XX-<slug>
   - resposta no formato obrigatório (KIMI_RULES.md)
6. Dono leva o diff + resposta para revisão externa (Claude / GPT).
7. Revisor responde: aprovado | ajustes pedidos.
8. Se ajustes: volta pro passo 3.
9. Se aprovado: dono faz merge em main.
10. Fecha a task.
```

## Naming de branch

- Formato: `feature/<id-task>-<slug-curto>`
- Exemplos:
  - `feature/F1-01-webhook`
  - `feature/F1-02-normalization`
  - `feature/F1-03-admin`

Nunca commitar direto em `main`. Nunca fazer force push em `main`.

## O que o revisor checa (checklist de review)

- [ ] Apenas os arquivos listados na task foram alterados
- [ ] Nenhuma migration foi modificada
- [ ] `src/shared/types/*` não foi alterado (a não ser que a task autorize)
- [ ] `package.json` não recebeu dependência nova (a não ser autorizado)
- [ ] Resposta veio no formato obrigatório (arquivos / checklist / pendências / riscos)
- [ ] Checklist da task está 100% marcado **ou** itens não marcados têm justificativa
- [ ] Critérios de aceite da task são verificáveis no diff
- [ ] Nenhum log vaza PII ou secrets
- [ ] Nenhum `any` injustificado
- [ ] Side effects isolados (I/O só nos repositories)
- [ ] Código em inglês, strings de erro podem ser pt-BR
- [ ] Sem abstração especulativa (arquivos/classes/interfaces sem segundo caller)

## O que bloqueia merge

Qualquer um dos itens abaixo bloqueia automaticamente:

1. Checklist da task com item não marcado e **sem** justificativa aceita
2. "Pendências" não vazias sem decisão de aceitar/rejeitar do dono
3. Migrations alteradas sem task dedicada
4. Dependência nova sem autorização
5. Contratos (`src/shared/types/`) alterados sem autorização
6. Arquivos fora do escopo alterados
7. Falha nos testes da task (quando a task exige testes)

## Quando a entrega volta para o Kimi

Com um único prompt no seguinte formato:

```
Ajustes pedidos na task F1-XX:

1. <descrição do ajuste 1>
2. <descrição do ajuste 2>

Regras:
- corrigir apenas o listado
- não refatorar outras partes
- mesmo formato obrigatório de resposta
```

## Quando a entrega é aceita

Dono faz:

```
git checkout main
git merge --no-ff feature/F1-XX-<slug>
git push origin main
git branch -d feature/F1-XX-<slug>
```

E marca a task como concluída no `docs/phases/PHASE_01.md`.

## Revisões em paralelo (Claude + GPT)

Quando houver divergência entre revisores:

- Divergência de estilo: dono decide.
- Divergência de arquitetura: abre ADR antes de merge.
- Divergência de correção (bug real vs paranoia): revisor que aponta bug tem o ônus
  da prova — reproduz o cenário ou prova com código.
