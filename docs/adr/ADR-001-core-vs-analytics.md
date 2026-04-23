# ADR-001 — Separação estrita entre `core` e `analytics`

## Status
Aceito.

## Data
2026-04-23

## Contexto
O Farejador captura dados do Chatwoot (fatos observados: contato, conversa, mensagem)
e produz, em fases posteriores, dados derivados (intenção, estágio do funil, motivo de
perda, transcrição de áudio). Misturar essas duas naturezas de dado na mesma tabela
destrói rastreabilidade: depois de um ano de operação, ninguém sabe o que foi dito de
fato vs. o que o sistema inferiu.

## Decisão
1. Schema `core.*` contém apenas dados **observados** no Chatwoot. Mapeamento é 1:1 e
   determinístico. Nada é inferido. Nada é interpretado.
2. Schema `analytics.*` contém apenas dados **derivados**: inferências, classificações,
   sinais agregados, transcrições.
3. Toda linha em `analytics.*` carrega proveniência obrigatória:
   `source`, `extractor_version`, `confidence_level`, `truth_type`.
4. Nenhuma coluna de `core.*` recebe valor inferido. Se a informação precisa ser
   derivada, ela vai em `analytics.conversation_facts` com `fact_key` apropriado.
5. LLMs e workers de enrichment escrevem **exclusivamente** em `analytics.*`.
   Nunca em `raw.*` ou `core.*`.

## Consequências

**Positivas:**
- Rastreabilidade preservada. Sempre sabemos se um dado é fato ou interpretação.
- Erros de extractor não corrompem o dado operacional. Basta reprocessar `analytics.*`.
- Dataset de treino futuro pode separar ground truth (observed) de weak supervision
  (inferred).
- Auditoria LGPD mais simples: apagar `analytics.*` de um contato não perde histórico
  da conversa original.

**Negativas:**
- Queries que misturam observado + inferido precisam de JOIN entre schemas.
- Mais disciplina arquitetural para manter a separação (fácil de relaxar sob pressão).

## Alternativas consideradas

- **Tudo em `core.*` com coluna `inferred` booleana.** Rejeitado: mistura natureza do dado
  na mesma linha, proveniência fica bagunçada, FK e índices viram confusão.
- **Tudo via views materializadas sobre `core.*`.** Rejeitado: perde capacidade de
  correção via `superseded_by`, perde versionamento de extractor.
