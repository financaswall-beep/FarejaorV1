# F2A-04 - Fronteira do fork

## Objetivo

Este documento existe para impedir que a base generica vire projeto de pneu antes
da hora.

## Quando esta task acontece

Depois de F2A-03:

- signals genericos existem;
- motor generico de regras existe;
- classificacoes genericas existem;
- `segments/generic` existe;
- `segments/_template` existe;
- nenhuma regra de pneu foi colocada no nucleo.

## Checklist tecnico antes da tag

- [ ] `npm run typecheck` verde.
- [ ] `npm test` verde.
- [ ] `npm run build` verde.
- [ ] `npm run enrich -- --conversation-id=<uuid> --segment=generic` validado quando houver DATABASE_URL.
- [ ] `docs/BASE_FORK_POINT.md` atualizado.
- [ ] `docs/HANDOFF.md` atualizado.
- [ ] `docs/CHECKLIST.md` atualizado.
- [ ] Confirmado que nao existe `segments/tires`.
- [ ] Confirmado que `src/enrichment/*` nao tem palavras de pneus hardcoded.
- [ ] Confirmado que ha pelo menos dois segmentos de prova: `generic` e `_template`.
- [ ] Migration `0011_relax_hint_type_check.sql` aplicada (CHECK fechado removido para extensibilidade por segmento).
- [ ] `SIGNAL_TIMEZONE` documentado em `docs/CONFIG.md` e default coerente com a operacao atual.
- [ ] `src/enrichment/rules.loader.ts` resolve `segments/` via `import.meta.url` (sem dependencia de `process.cwd()`).
- [ ] Wallace aprovou criar tag.

## Checklist operacional antes da tag final

- [ ] Shadow mode real rodado por periodo combinado sem fila travada.
- [ ] Secrets rotacionados antes de producao plena.
- [ ] `DATABASE_CA_CERT` configurado no Coolify.
- [ ] Harness de integracao com Postgres real criado ou decisao documentada.
- [ ] Stubs orfaos de teste em `environment=test` limpos ou documentados como dataset de teste.

Se o checklist tecnico estiver verde e o operacional ainda nao, o estado correto e:

```text
Codigo pronto para tag farejador-base-v1; tag aguardando pendencias operacionais.
```

## Tag sugerida

```powershell
git tag farejador-base-v1
git push origin farejador-base-v1
```

## Mensagem obrigatoria para Wallace

```text
Chegamos na fronteira do fork. Daqui para frente, criar regras de pneus vai dar
cara de segmento ao projeto. Recomendo salvar a base agora com a tag
farejador-base-v1 antes de continuar, desde que o checklist operacional tambem
esteja verde.
```

