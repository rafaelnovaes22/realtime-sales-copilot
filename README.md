# Novais Digital Forja Comercial — Co-pilot de Vendas Consultivas em Tempo Real

> Status: **aguardando aprovação** — plano completo definido, implementação não iniciada.

## O que é

Co-pilot de IA que escuta ligações de vendas ao vivo (Zoom/Meet), transcreve em tempo real com separação de vozes (closer vs cliente), detecta o estado da conversa e sugere ao closer o próximo movimento em menos de 3 segundos.

Não é um chatbot. É um assistente que sussurra no ouvido do closer no momento exato em que ele precisa.

## Casos de uso (por prioridade)

| # | Caso | Prioridade |
|---|---|---|
| P0 | Co-pilot durante ligação ao vivo | MVP |
| P1 | Pós-call: resumo + follow-up automático + CRM | Fase 2 |
| P2 | Treinamento offline (Q&A com o corpus) | Fase 3 |
| P3 | Coaching do gestor (replay + heatmap da equipe) | Fase 4 |

## Arquitetura resumida

```
Ligação ao vivo (Zoom/Meet)
    ↓ bot Recall.ai captura áudio diarizado
Deepgram STT — transcrição PT-BR streaming (<300ms)
    ↓ tokens {speaker, timestamp, texto}
Orquestrador WebSocket (backend)
    ├─ Detector de estado (Haiku 4.5) — onde estamos na conversa?
    ├─ Detector de gatilho (Haiku 4.5) — algo importante acabou de acontecer?
    ├─ Gerador de sugestão (Sonnet 4.6) — só quando gatilho dispara
    └─ Guardian (Haiku 4.5 + regex) — valida antes de enviar
    ↓ WebSocket
Frontend Next.js — painel ao vivo do closer
    ├─ Transcrição streaming
    ├─ Barra de progresso SPIN
    ├─ Cards de sugestão (👍/👎/✓dispensar)
    └─ Alertas de processo
```

## Stack

| Camada | Tecnologia |
|---|---|
| Captura de áudio | Recall.ai (bot Zoom/Meet) |
| STT | Deepgram (PT-BR, diarização nativa) |
| Backend | Node.js + Hono + TypeScript |
| Frontend | Next.js 14+ (App Router) + Tailwind + shadcn/ui |
| Banco de dados | Postgres + pgvector |
| Observabilidade | Langfuse |
| Hosting | Railway → GCP (migração planejada) |
| Modelos | Sonnet 4.6 (sugestões) + Haiku 4.5 (detectores + guardian) |

## Custo estimado por ligação

~R$ 6-7 por ligação de 60 minutos (STT + LLM + infra).

## Restrições críticas

- Zero referências a marcas proprietárias nas sugestões (3 camadas de proteção: corpus sanitizado + system prompt + guardian regex)
- Consentimento LGPD explícito obrigatório antes de toda chamada
- Latência fim-a-fim ≤ 3s (gatilho → sugestão na tela do closer)
- Sugestões curtas (1-2 linhas por card)
- Aprovação humana obrigatória antes de qualquer mudança em produção (self-harness com gate)

## Lifecycle (agent-governance-framework)

`SHADOW` (3-5 closers em paralelo) → `ASSISTED` (closer aceita/recusa) → `AUTONOMOUS` (sugestões otimizadas continuamente)

## Estrutura do repositório

```
realtime-sales-copilot/
├── corpus/
│   ├── raw/          # JSONs pós-ingest, pré-sanitização
│   └── clean/        # corpus.clean.json (brand-free, tagged, embeddings)
├── evals/
│   └── v1/           # 50 cenários de ligação para CI
├── scripts/
│   ├── ingest.ts
│   ├── sanitize.ts
│   ├── tag-corpus.ts
│   └── build-embeddings.ts
├── docs/
│   ├── foundry/        # documentação de governança
│   └── adr/          # ADR-001 (stack) e ADR-002 (LGPD/retenção)
├── examples/
│   └── novais-digital-comercial/
│       └── constitution-extension.md   # guardrails de domínio
├── apps/
│   ├── api/          # backend Hono + WebSocket
│   ├── web/          # frontend Next.js
│   └── worker/       # jobs pós-call, eval noturno, self-harness
└── .github/
    └── workflows/    # eval-suite.yml + deploy.yml
```

## Roadmap

### MVP — 2 semanas (foco: sugestão ao vivo)

| Semana | O que é feito | Entrega |
|---|---|---|
| 1 | Corpus limpo + pipeline de sugestão + transcrição ao vivo | Motor funcionando end-to-end |
| 2 | Frontend (painel do closer) + testes com closers reais | Demo pronta para a CEO |

→ Detalhes: [docs/mvp-2-semanas.md](docs/mvp-2-semanas.md)
→ Interface: [docs/interface-closer.md](docs/interface-closer.md)

### Versão completa — +4 semanas após MVP aprovado

| Fase | Semanas | Entrega |
|---|---|---|
| Infraestrutura (Recall.ai, diarização, auth, DB) | 3-4 | Produto pronto para produção |
| Pós-call automático + CRM | 1 | Follow-up ≤1h após ligação |
| Self-harness + aprendizado contínuo | 2-3 | Sistema que melhora sozinho |
| AUTONOMOUS + coaching do gestor | contínuo | Produto governado em produção |

→ Roadmap completo: [docs/roadmap.md](docs/roadmap.md)

## Decisões travadas

1. Co-pilot em tempo real é P0; Q&A offline é subproduto (P2)
2. Sanitização de marcas no ingest, terminologia genérica de mercado
3. Claude Agent SDK + Hono + WebSocket + Next.js
4. Railway como hosting inicial, migração GCP no Step 10
5. Sonnet 4.6 no gerador, Haiku 4.5 nos detectores e guardian

## Decisões pendentes (Step 0)

- [ ] Captura: Recall.ai vs extensão Chrome vs combinação?
- [ ] STT: Deepgram vs AssemblyAI vs Whisper self-host?
- [ ] Auth: NextAuth vs Clerk vs Supabase Auth?
- [ ] CRM alvo do pós-call (qual ferramenta os closers usam hoje?)
- [ ] Texto LGPD aprovado pelo jurídico
- [ ] Gate de refino: você + closer sênior, ou comitê de 3?
- [ ] Quem são os 3-5 closers do SHADOW?

## Licença

Copyright (c) 2026 Rafael Novaes.

Licenciado sob [MIT License](./LICENSE) — © 2026 Rafael Novaes.
