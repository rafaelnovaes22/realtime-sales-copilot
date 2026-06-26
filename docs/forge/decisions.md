# Registro de decisões — Acme Forja Comercial

## Decisões travadas

| ID | Decisão | Data |
|---|---|---|
| D001 | Arquivo B (`aulas_completas_com_exemplos_treinamento_vendas.md`) é subset de C — descartado | 2026-05-18 |
| D002 | Arquivo A reduzido a `taxonomia-50-temas.json` — corpo descartado para evitar dominância no retrieval | 2026-05-18 |
| D003 | Sanitização de marcas no ingest, terminologia genérica, provenance interna mantida em metadado | 2026-05-18 |
| D004 | Foco P0: co-pilot em tempo real; Q&A offline é subproduto (P2) reaproveitando mesmo corpus | 2026-05-18 |
| D005 | ~~Runtime: Claude Agent SDK + Hono + WebSocket + Next.js 14+ App Router~~ — **SUPERSEDED por D010** (orquestração via LangGraph.js); Hono/Next.js permanecem | 2026-05-18 |
| D006 | Hosting inicial: Railway; migração GCP planejada para Step 10 | 2026-05-18 |
| D007 | ~~Modelos: Sonnet 4.6 no gerador; Haiku 4.5 nos detectores e guardian~~ — **SUPERSEDED por D011** (Gemini 2.5 Flash primário; Anthropic fallback) | 2026-05-18 |
| D008 | Guardian híbrido: regex determinístico para brand leakage + Haiku 4.5 para tom e tamanho | 2026-05-18 |
| D009 | Self-harness com gate humano obrigatório — nenhuma mudança vai a produção sem aprovação | 2026-05-18 |
| D010 | Orquestração do pipeline de objeções via **LangGraph.js** (StateGraph), substituindo a state machine linear. Ver ADR-003. | 2026-06-26 |
| D011 | **Gemini 2.5 Flash via Vertex AI** como provider primário (todos os roles); **Anthropic** (Sonnet 4.6 / Haiku 4.5) como fallback de portabilidade (C7). LangGraph só orquestra; toda chamada LLM passa por `src/llm` (observe()/C6 + FallbackProvider). Ver ADR-003. | 2026-06-26 |
| D012 | Aprendizado com os inputs do cliente é **mediado por relatório de acompanhamento + indicador de mudança (drift) → intervenção humana** (sem auto-mutação de comportamento; C4). Few-shot adaptativo em tempo real (in-context) é a única adaptação automática. Ver ADR-003. | 2026-06-26 |

## Decisões pendentes (Step 0)

| ID | Decisão | Contexto |
|---|---|---|
| P001 | Captura de áudio: Recall.ai vs extensão Chrome vs combinação | Recall.ai mais estável, extensão mais barata |
| P002 | STT: Deepgram vs AssemblyAI | Testar com amostras PT-BR reais |
| P003 | Auth: NextAuth vs Clerk vs Supabase Auth | Verificar o que Acme já usa nos outros produtos |
| P004 | CRM destino do pós-call | Qual ferramenta os closers usam hoje? |
| P005 | Texto LGPD do consentimento | Requer aprovação jurídica antes do Step 5 |
| P006 | Gate de aprovação de refino | Você + closer sênior, ou comitê incluindo CEO? |
| P007 | Closers do SHADOW | Definir 3-5 nomes antes do Step 6 |
