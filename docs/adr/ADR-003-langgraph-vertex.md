# ADR-003 — Orquestração LangGraph.js + Gemini (Vertex) primário + loop de aprendizado

**Status:** ACEITA — 2026-06-26
**Supersede:** parte de ADR-001 / D005 (runtime de orquestração) e D007 (modelos). Hono e Next.js de D005 permanecem.
**Relacionada:** C3, C4, C5, C6, C7, C8 (`.claude/CONSTITUTION.md`); D010, D011, D012 (`docs/forge/decisions.md`).

## Contexto

Uma venda estratégica gera muitas objeções, de tipos variados (preço, autoridade/decisor terceiro, ceticismo, timing, status quo, brush-off). O pipeline original era uma state machine linear de uma única chamada LLM (Sonnet 4.6), sem roteamento por tipo de objeção, sem distinguir objeção real de cortina de fumaça, sem refino, e sem usar o feedback do closer (o loop estava aberto).

Decidiu-se: (1) reorganizar a orquestração como um grafo de agentes; (2) trocar o provider primário para reduzir custo/latência e viabilizar um grafo mais rico; (3) fechar o loop de aprendizado com os inputs do cliente, sem auto-mutar comportamento em produção.

## Decisão

1. **Orquestração via LangGraph.js** (`@langchain/langgraph`, StateGraph) em `apps/api/src/graph/` — substitui a state machine linear (D010). Nodes: `detect` → fork(`classifyObjecao` ∥ `inferEstado` ∥ `recuperarExemplos`) → `retrieve` → `gerarVariacoes` (fan-out N=2) → `ranquear` → `guardian` (loop `refinar`, MAX_REFINO=1). Early-exits `no_gatilho`/`no_chunks`.

2. **Gemini 2.5 Flash via Vertex AI como provider primário** (todos os roles); **Anthropic (Sonnet 4.6 / Haiku 4.5) como fallback** de portabilidade (D011). SDK: `@google/genai` com `vertexai:true` (sucessor unificado de `@google-cloud/vertexai`). Custo do Flash (~10-20x menor que Sonnet) torna o grafo rico viável sob C3.

3. **LangGraph só orquestra.** Nenhum node importa SDK de provider; toda chamada LLM passa por `getLLM(role).complete()` de `src/llm`, que aplica `observe()` (C6) e o `FallbackProvider` Gemini→Anthropic (C7). O SDK Google vive apenas em `src/llm/adapters/gemini.ts` (gate G1).

4. **Aprendizado mediado, sem auto-mutação** (D012, honra C4):
   - *Few-shot adaptativo* (tempo real, in-context): `recuperarExemplos` injeta sugestões passadas vencedoras (aceitas sem edição ou com venda avançada/fechada) no prompt do gerador. Não altera prompt canônico nem modelo.
   - *Acompanhamento*: indicadores (aceitação, edição, dispensa, outcome, latência) por tipo/closer; **indicador de mudança (drift)** compara janelas e sinaliza ao cruzar limiar; **relatório** (`docs/forge/learning-reports/` + `/api/learning/report`) recomenda intervenção. A alteração de prompt/corpus é decidida por um humano e aplicada via gate (loop offline — Step 9).
   - *Sinais capturados*: edição do card pelo closer (`final_text`/`edit_distance`) e outcome da venda, além de 👍/👎/dispensar. PII sanitizada antes de persistir (LGPD).

## Consequências

- **Positivas:** roteamento por tipo de objeção; classificação real-vs-cortina; refino automático; custo por sugestão muito abaixo do cap C3; loop de feedback fechado com governança humana; portabilidade real exercida (fallback cross-provider).
- **Riscos:** latência de rede Vertex (+150-400ms/call) passa a ser o limitante do SLA p95 ≤ 3s — mitigada por paralelismo e medição na promoção; auth GCP no Railway exige service-account key (migrar p/ Cloud Run + Workload Identity no Step 10).
- **Débitos:** `cacheSystem` é no-op no Gemini (explicit context caching futuro); few-shot por SQL (gatilho/tipo) — similaridade semântica via pgvector é evolução; corpus precisa de re-tag conceitual nos 18 gatilhos (tooling pronto, execução pendente de creds Gemini).
- **Gates afetados:** G1 do pre-merge-check (Forge canônico) deve incluir `@google/genai`/`@google-cloud/vertexai`; G3/C6 cobre todos os adapters; G4 reflete novos arquivos; G5 (eval) requer re-taxonomização para os 18 gatilhos.
