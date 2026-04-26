# Prompt para Kimi - F2A-03 classificacoes deterministicas genericas

Copie e cole este prompt para o Kimi quando for executar a terceira entrega da Fase 2a.

```text
Leia e obedeca docs/KIMI_RULES.md antes de qualquer coisa.

Leia tambem:
- AGENTS.md
- docs/PROJECT.md
- docs/F2A_ARCHITECTURE.md
- docs/F2A_KIMI_IMPLEMENTATION_GUIDE.md
- docs/phases/PHASE_02A.md
- docs/tasks/F2A-03-generic-classifications.md
- docs/CONTRACTS.md
- docs/LOGGING.md
- docs/CONFIG.md

---

## Sua tarefa: F2A-03 - classificacoes deterministicas genericas

Implementar APENAS a task docs/tasks/F2A-03-generic-classifications.md.

Objetivo:
Gerar classificacoes deterministicas em analytics.conversation_classifications a
partir de signals, hints e facts. Sem LLM. Sem regra de pneu. Sem inventar valor
quando a evidencia for fraca.

---

## Arquivos permitidos

Voce pode criar/alterar somente:

- src/enrichment/classification.service.ts
- src/enrichment/classifications.repository.ts
- db/migrations/0012_classification_ruleset_auditability.sql
- tests/unit/enrichment/classification.service.test.ts
- tests/unit/enrichment/classifications.repository.test.ts
- docs/tasks/F2A-03-generic-classifications.md (apenas para registrar detalhe da entrega)

Pode alterar src/enrichment/cli.ts apenas se for necessario para executar
classificacoes no mesmo comando npm run enrich. Se alterar, manter retrocompat
com signals e hints/facts ja em uso.

Nao crie segments/tires.
Nao crie regra de pneu.
Nao adicione hint_type novo nem fact_key novo nesta task; consuma os ja existentes.
Nao altere migrations antigas (0001..0011).

---

## Regras absolutas

- Escrever somente em analytics.conversation_classifications.
- Ler somente core.* e analytics.*.
- Nao escrever em raw.*.
- Nao escrever em core.*.
- Nao escrever em ops.*.
- Nao chamar LLM.
- Nao criar endpoint admin.
- Nao alterar src/shared/types/chatwoot.ts.
- Nao adicionar dependencia em package.json.

---

## Migration obrigatoria

Numero: 0012_classification_ruleset_auditability.sql

O numero 0011 ja foi usado por 0011_relax_hint_type_check.sql na auditoria
pos-F2A-02 (que removeu o CHECK fechado em analytics.linguistic_hints.hint_type
para permitir extensibilidade por segmento).

Conteudo minimo da 0012:

- Adicionar coluna ruleset_hash TEXT NOT NULL DEFAULT 'pre_audit_v1' em
  analytics.conversation_classifications.
- Atualizar idempotencia para
  (environment, conversation_id, dimension, source, extractor_version, ruleset_hash).
  Use o mesmo padrao da 0010_analytics_ruleset_auditability.sql:
    - dedup pre-existente antes da constraint;
    - DO $$ BEGIN ... IF NOT EXISTS ... ALTER TABLE ... ADD CONSTRAINT ... END $$;
    - COMMENT ON CONSTRAINT explicando idempotencia.
- Backfill de linhas antigas com ruleset_hash = 'pre_audit_v1' (default ja cobre,
  mas deixe explicito em comentario se necessario).

Migration deve ser idempotente (CREATE/ADD com IF NOT EXISTS) para poder ser
reaplicada com seguranca.

---

## Provenance obrigatoria

Use:

source = deterministic_classification_v1
truth_type = inferred
extractor_version = f2a_classification_v1
ruleset_hash = <ver regra abaixo>

Confidence deve refletir a forca da evidencia:

- evidencia direta forte (ex.: hint price_complaint + fact price_quoted): >= 0.80;
- evidencia indireta media: 0.55 a 0.75;
- evidencia fraca: nao gravar linha.

Politica de ruleset_hash:

- Se a classificacao usar um unico hint/fact derivado de regras, herdar o
  ruleset_hash dele.
- Se combinar varios hashes diferentes, ordenar a lista (asc), unir por '\n' e
  calcular SHA-256 do buffer resultante. Documente em comentario no codigo.
- Se a classificacao for derivada apenas de signals (sem regras), usar
  'no_ruleset_v1' como sentinela explicita.

---

## Dimensoes obrigatorias

Gravar quando houver evidencia clara:

- stage_reached: new_conversation | need_identified | price_requested | quote_sent | purchase_intent | closed
- buyer_intent: low | medium | high
- urgency: low | medium | high
- final_outcome: won | lost | no_response  (nao gravar 'unknown' so por falta de evidencia)
- loss_reason: price | competitor | no_response  (delivery e stock so gravar
  com evidencia generica clara; cobertura forte vem em pacote de segmento)

Nao gravar dimensao quando a evidencia for fraca. Preferir ausencia de linha a
linha 'unknown'.

---

## Testes obrigatorios

Cobrir:

- nao classifica quando nao ha evidencia (nenhuma linha gerada);
- detecta urgencia generica a partir de hint urgency_marker;
- detecta loss_reason=price a partir de hint price_complaint sem fechamento;
- detecta buyer_intent=high a partir de hint positive_marker + fact price_quoted;
- detecta stage_reached=quote_sent a partir de fact price_quoted;
- idempotencia por (environment, conversation_id, dimension, source, extractor_version, ruleset_hash);
- linhas escritas carregam ruleset_hash nao-nulo;
- ruleset_hash combinado: lista ordenada + newline + SHA-256;
- ruleset_hash sentinela 'no_ruleset_v1' quando classificacao vem so de signals;
- SQL nao contem INSERT/UPDATE em raw. nem core.;
- repositorio respeita ON CONFLICT DO UPDATE com colunas exatas (sem sobrescrever provenance imutavel);
- garantia textual de que nao ha vocabulario de pneu no codigo (grep negativo por
  'pneu', 'tire', 'aro', medidas tipo '/').

---

## CLI

Se integrar classificacoes no npm run enrich, manter:

npm run enrich -- --conversation-id=<uuid> --segment=generic

Ordem de execucao recomendada dentro do CLI: signals -> rules engine -> classifications.
Cada etapa deve ser idempotente individualmente. Se uma falhar, registrar erro e
nao executar a seguinte.

---

## Supabase

Aplicar a migration 0012 no Supabase environment=test antes de declarar entrega
verde. Nao commitar .env.codex. Nao imprimir secrets. Se DATABASE_URL nao
estiver disponivel, registrar pendencia em ## Pendencias e seguir com testes
locais; nao bloquear a entrega por isso.

Apos aplicar a migration, valide com:

- SELECT existencia da coluna ruleset_hash;
- SELECT existencia da constraint UNIQUE;
- INSERT proba + INSERT identico = no-op (idempotencia);
- INSERT com ruleset_hash diferente = nova linha.

---

## Validacao obrigatoria

Execute:

npm run typecheck
npm test
npm run build

Todos devem ficar verdes. Reporte numero de testes (xxx/xxx).

---

## Formato de entrega

Obrigatorio, conforme docs/KIMI_RULES.md:

## Arquivos alterados
## Checklist
## Pendencias
## Riscos

Inclua tambem o resumo da validacao executada (typecheck, npm test, build) e a
saida do teste de idempotencia no Supabase.
```
