# ADR-003 — Nenhum arquivo ou camada prematuros

## Status
Aceito.

## Data
2026-04-23

## Contexto
Existe a intuição (equivocada) de que criar muitos arquivos e camadas antecipadamente
protege contra refatoração futura. Na prática:

- Pastas vazias "reservadas" enviesam decisões futuras (o código vai pra onde já existe
  espaço, mesmo que seja o lugar errado).
- Abstração prematura congela decisões erradas.
- Arquivos com uma função só aumentam ruído sem agregar estrutura.
- O que evita refatoração é **contrato estável**, não quantidade de arquivos.

## Decisão
1. Crie um arquivo quando houver **código real** para colocar nele.
2. Crie uma abstração quando houver **segundo caller real** demandando.
3. Crie uma pasta de módulo quando tiver **pelo menos 2 arquivos** que pertencem lá
   por responsabilidade comum.
4. Não crie pasta "preparatória" para fase futura. Fase 2 cria `src/enrichment/`
   quando começar. Fase 3 cria o serviço atendente em outro container.
5. Estrutura inicial da Fase 1 está em `docs/phases/PHASE_01.md` — não expandir sem
   task autorizando.

## Consequências

**Positivas:**
- Codebase pequena e legível na Fase 1 (~20-30 arquivos).
- Decisões estruturais tomadas em cima de uso real, não em especulação.
- Onboarding rápido: cada pasta existe por um motivo concreto.

**Negativas:**
- Quem vem de projetos enterprise pode achar "sem estrutura".
- Uma refatoração real pode ser necessária quando Fase 2 começar — e isso é **certo**
  e **desejado**, porque aí teremos informação real sobre o que precisa existir.

## Aplicação prática

### Permitido
- Criar `src/webhooks/chatwoot.handler.ts` na task F1-01 (tem código real).
- Criar `src/shared/types/chatwoot.ts` antes das tasks (é contrato pré-definido, stub).

### Proibido sem autorização
- Criar `src/enrichment/` "pra deixar pronto" (Fase 2 cria quando for o momento).
- Criar `src/shared/utils/stringUtils.ts` com uma função que só tem um caller.
- Criar `src/infra/`, `src/core/`, `src/domain/` (camadas hexagonais ornamentais).
- Criar interface `IRepository<T>` com uma só implementação.
- Criar classe `AbstractHandler` porque "pode ter outro handler um dia".
