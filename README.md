# Real-time Sales Co-pilot — reference implementation

Co-pilot de IA para vendas consultivas ao vivo: escuta a ligação, transcreve em streaming, detecta objeções do cliente e sugere ao vendedor (closer) a próxima fala em menos de 3 segundos.

Esta é uma implementação de referência genérica. O produto vendido nos exemplos é fictício (um SaaS de gestão comercial); corpus, gatilhos e evals são configuráveis para qualquer operação de venda consultiva.

## O que demonstra

- **Transcrição streaming** com Deepgram Nova (PT-BR, <300ms por token)
- **Sugestão via LLM em <3s** fim-a-fim (p95 medido: 2,8s) — Sonnet no gerador, Haiku nos detectores
- **Custo ~R$ 0,025 por sugestão** (prompt caching + modelos pequenos nos detectores)
- **Gatilhos de objeção configuráveis** — 18 regex de detecção (preço, timing, concorrente, autoridade, garantia, adoção) + retrieval de corpus tagueado por gatilho
- **3 camadas anti-leakage de marca**: corpus sanitizado no ingest, system prompt com proibidos, guardian regex no runtime
- **Pipeline em grafo** (LangGraph): detect → classify → retrieve → generate → guardian

## Arquitetura

```
Ligação ao vivo (Zoom/Meet)
    ↓ captura de áudio (browser SDK no MVP; bot diarizado na v2)
Deepgram STT — transcrição PT-BR streaming
    ↓ tokens {speaker, timestamp, texto}
Orquestrador (Hono + WebSocket)
    ├─ Detector de gatilho (regex, 18 objeções)
    ├─ Classificador de tipo de objeção (preço / timing / autoridade / ceticismo / status quo / brush-off)
    ├─ Retriever — chunks do corpus tagueados pelo gatilho
    ├─ Gerador de sugestão (Sonnet) — só quando gatilho dispara
    └─ Guardian (regex + limites) — valida antes de exibir
    ↓ WebSocket
Painel do closer — transcrição ao vivo + cards de sugestão (👍/👎/dispensar)
```

## Stack

| Camada | Tecnologia |
|---|---|
| STT | Deepgram (PT-BR, streaming) |
| Backend | Node.js 20+ · TypeScript · Hono · WebSocket |
| Orquestração | LangGraph |
| LLM | Claude Sonnet (gerador) + Haiku (tagger/detectores), com abstração de provider (`src/llm/`) |
| Banco | Postgres (feedback e aprendizado contínuo) |
| Observabilidade | LangSmith (opcional, via `LANGCHAIN_API_KEY`) |

## Como rodar

Pré-requisitos: Node 20+, chaves de API (Deepgram e Anthropic ou Vertex AI).

```bash
npm install
cp .env.example .env        # preencha DEEPGRAM_API_KEY e ANTHROPIC_API_KEY (ou GCP_*)

# Smoke tests
npm run test:deepgram       # valida STT PT-BR
npm run test:pipeline       # pipeline end-to-end com cenários sintéticos, mede latência

# POC web (transcrição + sugestões ao vivo no browser)
npm run dev:poc             # http://localhost:3000

# Pipeline de corpus (a partir de markdowns próprios em corpus/source/)
npm run corpus              # ingest → sanitize (brand-glossary) → tag (LLM)

# Validação
npm run typecheck
```

## Adaptando para a sua operação

1. **Corpus**: coloque seu material de treinamento (markdown) em `corpus/source/` e rode `npm run corpus`. A sanitização usa `corpus/glossary/brand-glossary.json` — troque as entradas fictícias (`Acme*`) pelos seus termos proprietários.
2. **Gatilhos**: edite os regex em `apps/api/src/gatilhos.ts` e o mapeamento gatilho → tipo de objeção em `apps/api/src/graph/nodes/objecao-tipo.ts`.
3. **Prompt**: o system prompt do gerador é versionado em `prompts/live-suggestion-copilot/`.
4. **Evals**: 50 casos com rubrica LLM-as-judge em `evals/live-suggestion-copilot/cases/` servem de modelo para os seus cenários.

## Governança

O repositório é operado pelo framework **Novais Digital Foundry** (constitution, ADRs, eval gates, lifecycle SHADOW → ASSISTED → AUTONOMOUS). Ver `docs/foundry/` e `.claude/CONSTITUTION.md`.

Restrições de produto que o pipeline garante:

- Sugestões de 1-2 linhas (≤280 chars), no máximo 3 cards por gatilho
- Zero citação de marca/termo proprietário (gate duro do guardian)
- Latência fim-a-fim ≤3s do gatilho ao card
- Consentimento LGPD registrado antes de toda chamada

## Licença

Copyright (c) 2026 Rafael Novaes.

Licenciado sob [PolyForm Noncommercial License 1.0.0](./LICENSE.md) — leitura, estudo e uso não comercial permitidos; uso comercial requer autorização expressa do autor.
