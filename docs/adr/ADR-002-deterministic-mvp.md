# ADR-002 — MVP determinístico, sem LLM no runtime

## Status
Aceito.

## Data
2026-04-23

## Contexto
Existe tentação de usar LLM cedo para "resolver" casos difíceis: payloads com campos
faltando, eventos fora de ordem, detecção de intenção. Cada uma dessas tentações
introduz não-determinismo, custo por mensagem, e risco de alucinação em dado
operacional. O Farejador é a **fundação de dados** — se a fundação é instável, tudo
que for construído em cima herda o problema.

## Decisão
1. A Fase 1 (Farejador MVP) é **totalmente determinística**.
2. Nenhuma chamada de LLM no caminho do webhook.
3. Nenhuma chamada de LLM no normalizer async.
4. Nenhuma chamada de LLM durante escritas em `core.*`.
5. O mapeamento payload → tabelas é função pura: mesmo input sempre produz o mesmo
   output.
6. Casos ambíguos viram `ops.enrichment_jobs` (fila) para resolução posterior em
   fases 2a/2b. Nunca viram palpite no runtime.

## Consequências

**Positivas:**
- Custo operacional previsível (sem cota de API queimando por webhook).
- Latência previsível (sem chamada externa pendurada no hot path).
- Testabilidade total: cada normalizer tem input/output fixo, coberto por fixtures.
- Replay perfeito: reprocessar `raw.raw_events` produz exatamente o mesmo `core.*`.
- Debug trivial: zero não-determinismo para caçar.

**Negativas:**
- Informação que exige interpretação (ex: "qual o produto dessa conversa?") não é
  preenchida na Fase 1. Fica para 2a/2b.
- Campos derivados (stage, outcome, loss_reason) ficam vazios até 2a/2b entrarem.

## Alternativas consideradas

- **LLM "leve" para extrair nome do produto quando payload do Chatwoot não tem.**
  Rejeitado: contamina `core.*` com dado inferido, violando ADR-001. Ambíguo para
  auditoria. Custo por mensagem. Se precisa do produto, fica em `analytics.*`.
- **LLM como fallback quando regex falha.** Rejeitado: mesmo argumento. Regex vai em
  Fase 2a (populando `analytics.linguistic_hints`), LLM vai em Fase 2b. Core fica
  intocado.
