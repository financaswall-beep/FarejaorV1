# F2A-03 - Fronteira do fork

## Objetivo

Este documento existe para impedir que a base generica vire projeto de pneu antes
da hora.

## Quando esta task acontece

Depois de F2A-02:

- signals genericos existem;
- motor generico de regras existe;
- `segments/generic` existe;
- nenhuma regra de pneu foi colocada no nucleo.

## Checklist antes da tag

- [ ] `npm run typecheck` verde.
- [ ] `npm test` verde.
- [ ] `npm run build` verde.
- [ ] `docs/BASE_FORK_POINT.md` atualizado.
- [ ] `docs/HANDOFF.md` atualizado.
- [ ] `docs/CHECKLIST.md` atualizado.
- [ ] Confirmado que nao existe `segments/tires`.
- [ ] Confirmado que `src/enrichment/*` nao tem palavras de pneus hardcoded.
- [ ] Wallace aprovado para criar tag.

## Tag sugerida

```powershell
git tag farejador-base-v1
git push origin farejador-base-v1
```

## Mensagem obrigatoria para Wallace

```text
Chegamos na fronteira do fork. Daqui para frente, criar regras de pneus vai dar
cara de segmento ao projeto. Recomendo salvar a base agora com a tag
farejador-base-v1 antes de continuar.
```

