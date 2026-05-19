# realtime-sales-copilot — Guia para Claude Code

> Co-pilot de IA para closers de vendas consultivas em tempo real. Captura ligação, transcreve, detecta gatilhos e sussurra sugestões curtas para o closer.
> Operado pelo framework **Acme Forge** v0.21.0 ([`docs/forge/project.json`](docs/forge/project.json)).

---

## Antes de qualquer coisa: leia a Constitution

**Arquivo obrigatório**: [`.claude/CONSTITUTION.md`](.claude/CONSTITUTION.md)

Os 8 princípios são não-negociáveis e orientam toda decisão neste repositório:

1. **C1** — Diagnose-before-build
2. **C2** — Outcome-first, never tech-first
3. **C3** — Custo ≤ 25% do preço (cost_per_outcome)
4. **C4** — SHADOW → ASSISTED → AUTONOMOUS (janela mínima de 14 dias para módulos críticos)
5. **C5** — Three-tier context (L0/L1/L2)
6. **C6** — Telemetria obrigatória (Langfuse para chamadas LLM)
7. **C7** — Portabilidade sobre lock-in (LLM/STT/infra em camadas isoladas)
8. **C8** — Configuration over heroic customization

Se uma instrução conflitar com a Constitution, **levante o conflito antes de executar**.

> Operação adaptativa sob Forge: ver [`templates/master-prompt.md`](./templates/master-prompt.md).

---

## Extensão de domínio (obrigatória)

[`examples/acme-comercial/constitution-extension.md`](examples/acme-comercial/constitution-extension.md) define guardrails específicos deste projeto:

- **Proibido em toda sugestão**: nome de seguradora, marca, programa proprietário (Life Planner, TS1, MFA, W1, 3W+, MFB). Promessa de rentabilidade. Citação de fonte ("conforme aula X").
- **Obrigatório em toda sugestão**: voz consultiva, cards 1-2 linhas, latência ≤3s, ≤3 cards por gatilho.
- **Obrigatório antes da chamada**: consentimento LGPD registrado, opt-out durante toda a chamada.

Três camadas anti-leakage: corpus sanitizado no ingest, system prompt com proibidos, guardian regex no runtime.

---

## Contexto do projeto

- **project_type**: `agentic_saas` (declarado em `docs/forge/project.json`)
- **ai_enabled**: `true` (Sonnet 4.6 gerador + Haiku 4.5 detectores e guardian)
- **Lifecycle**: `SHADOW` (3-5 closers paralelos) → `ASSISTED` (closer aceita/recusa) → `AUTONOMOUS`
- **Estado atual**: módulo `live-suggestion-copilot` em DRAFT, pipeline funcional end-to-end com latência p95 = 2.8s

### Stack

- **Runtime**: Node 20+, TypeScript 5.7, ESM, tsx
- **LLM**: `@anthropic-ai/sdk` — Sonnet 4.6 (sugestões) + Haiku 4.5 (tag + guardian futuro)
- **STT**: `@deepgram/sdk` — Nova-3 (PT-BR streaming, browser SDK)
- **Observabilidade**: Langfuse (obrigatório para chamadas LLM em produção — C6)
- **Frontend** (próximo): Next.js 14+ App Router + Tailwind + shadcn/ui
- **Backend** (próximo): Hono + WebSocket
- **DB** (próximo): Postgres + pgvector
- **Hosting**: Railway (inicial) → GCP (Step 10 do roadmap)

### Comandos úteis

```bash
# Corpus
npm run ingest         # markdown → chunks
npm run sanitize       # remove brand leakage
npm run tag            # tag via Haiku 4.5
npm run corpus         # encadeia os três

# Smoke tests
npm run test:deepgram  # valida API key + nova-3 + nova-2 PT-BR
npm run test:pipeline  # end-to-end com 5 cenários, mede latência

# Validação
npm run typecheck
bash scripts/forge-doctor.sh --consumer
```

---

## Estrutura do repo

```
apps/
└── api/src/
    ├── gatilhos.ts          # 10 regex de detecção
    ├── retriever.ts         # scoring + top-N do corpus
    ├── generator.ts         # Sonnet 4.6 com chunks
    ├── guardian.ts          # regex final + limites de tamanho
    └── pipeline.ts          # orquestra os 4
corpus/
├── source/                  # MDs originais (gitignored — IP-sensitive)
├── raw/                     # pós-ingest (gitignored)
├── clean/                   # pós-sanitize+tag (gitignored)
└── glossary/
    └── brand-glossary.json  # substituições + auditCheck
scripts/
├── ingest.ts, sanitize.ts, tag-corpus.ts
├── test-deepgram.ts, test-pipeline.ts
└── forge, forge-doctor.sh   # Forge canônico
docs/
├── forge/
│   ├── project.json         # declaração canônica (agentic_saas + ai_enabled)
│   └── decisions.md         # D001-D009 já travadas
└── adr/                     # ADR-001 stack, ADR-002 LGPD
examples/
└── acme-comercial/
    └── constitution-extension.md  # guardrails de domínio
.claude/
├── CONSTITUTION.md          # princípios canônicos (LER PRIMEIRO)
├── agents/                  # 12 Guardians
├── commands/acme/         # /acme:* slash commands
└── skills/{L0,L1,L2}/       # skills por tier
hooks/                       # pre/post-tool-use + session-start + stop
templates/                   # adr, eval-case, project, etc.
reviewer/                    # contrato com DeepAgent externo
```

### Regras de toque

| Path | Regra |
|---|---|
| `.claude/CONSTITUTION.md` | Mudança exige ADR + bump (hook `adr-approval-gate` bloqueia) |
| `docs/adr/*.md` (assinada) | Não muda; abrir nova ADR |
| `docs/forge/project.json` | Mudança em `project.type` ou `ai_enabled` exige ADR + nova auditoria |
| `corpus/glossary/brand-glossary.json` | Adição de termos sempre permitida; remoção exige justificativa |
| `apps/api/src/guardian.ts` | Aumentar permissividade exige ADR + eval cases novos |
| `apps/api/src/generator.ts` (system prompt) | Mudança versionada via `prompts/{id}/v{n}/system.md` (futuro) |

---

## Padrões obrigatórios

### Telemetria (C6)

Toda chamada LLM em produção precisa estar instrumentada com Langfuse. O
wrapper canônico vive em `src/observability/trace.ts`:

```ts
import { observe } from "src/observability/trace.js";

return observe(
  { name: "live-suggestion-generator", tenantId, model: "claude-sonnet-4-6" },
  async (trace) => {
    trace.input({ system, user });
    const resp = await sdk.messages.create({ /* ... */ });
    trace.output({ text, usage: resp.usage });
    trace.cost({ brl: estimateCost(resp.usage) });
    return resp;
  },
);
```

Sem trace, **não conta como outcome auditável**. Hook `langfuse-trace-check`
valida em PR. O wrapper `observe()` está integrado no Anthropic adapter — todas
chamadas LLM já passam por ele.

> **Status atual**: instrumentação presente; ativação condicionada a
> `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` em `.env`. Quando ausentes,
> wrapper vira no-op silencioso. Antes da promoção SHADOW, criar conta
> (cloud.langfuse.com ou self-hosted), preencher as vars e validar
> `trace_coverage ≥ 99%` por 7 dias.

### Three-tier context (C5)

| Tier | Conteúdo | Lê de |
|---|---|---|
| L0 | DNA, ICP, ofertas, princípios universais de venda consultiva | apenas L0 |
| L1 | corretora/tenant, configuração de instância, perfil do closer | L0 + L1 |
| L2 | execução de sugestão individual (call run, suggestion run, eval case) | L0 + L1 + L2 |

Quebrar a hierarquia (ex: skill L0 lendo turno de chamada) viola C5 e bloqueia merge.

### Portabilidade (C7)

| Camada | Responsabilidade | Local |
|---|---|---|
| `src/llm/` | abstrai Anthropic SDK (futuro: OpenAI fallback) | a criar |
| `src/stt/` | abstrai Deepgram (futuro: AssemblyAI fallback) | a criar |
| `apps/api/src/generator.ts` | hoje chama `Anthropic` direto — débito C7 |

> O MVP atual viola C7 (Anthropic SDK importado direto no generator). Antes da promoção ASSISTED, mover para `src/llm/`.

### Anti-customização (C8)

- Nada de `if (tenantId === '...')` em código de produção.
- Lint do hook `any-type-guard` + reviewer DeepAgent validam.
- Variações por cliente entram via configuração de tenant (futuro) ou via novo SKU.

---

## Fluxo Forge (sequência típica)

```
1. /acme:diagnose          → qualifica problema, baseline humano (CEO/closer atual)
2. /acme:spec              → cláusula de outcome do co-pilot (latência, agreement_rate, leak_rate)
3. /acme:unit-economics    → custo por sugestão viável (C3) — alvo ≤ 25% do preço/outcome
4. /acme:sla-threshold     → latência p95 ≤3s, leakage = 0, agreement ≥70% (Shadow)
5. /acme:plan              → 3 camadas (corpus + pipeline + UI), C7 abstraction
6. /acme:tasks             → ondas com dependências (já estamos na onda 2-3 do MVP)
7. /acme:implement         → código + prompts versionados
8. /acme:eval              → suíte de 50 cenários (Step 4 do roadmap)
9. /acme:pre-merge-check   → 5 gates go/no-go antes do PR mergear
10. /acme:promote          → SHADOW (3-5 closers) → ASSISTED → AUTONOMOUS
11. /acme:audit-monthly    → drift detection + scoring (DeepAgent externo)
```

> Status atual: pulamos formalmente as etapas 1-4 (diagnose/spec/unit-economics/sla). O MVP atual é um spike técnico. Antes de SHADOW, os artefatos canônicos devem existir.

---

## Reviewer externo

Auditoria mensal por **DeepAgent** (GPT-5.5) valida os 8 princípios + coerência entre artefatos. Veja `reviewer/prompt.template.md` + `reviewer/validation-rules.json`.

Para o reviewer funcionar:
- Toda mudança no Forge atualiza `docs/forge/manifest.json` (futuro)
- Toda LLM call tem trace Langfuse (futuro)
- Toda promoção de modo é registrada via `/acme:promote`

---

## Quando pedir confirmação ao usuário

Operações reversíveis e locais (edição em `apps/api/src/`, criação de eval cases, mudanças em corpus/glossary, tagging) não exigem confirmação prévia — só siga os padrões.

**Sempre confirme antes de**:
- Editar `.claude/CONSTITUTION.md` (precisa nova ADR)
- Editar `docs/adr/*.md` assinada
- Editar `docs/forge/project.json` campos críticos (`project.type`, `ai_enabled`)
- Promover lifecycle (DRAFT → SHADOW → ASSISTED → AUTONOMOUS)
- Executar `git push --force`, `prisma migrate reset`, `rm -rf` (Forge nega via `settings.json`)

---

## Memory file system

Memória persistente em `C:\Users\Rafael\.claude\projects\c--Users-Rafael-Projetos-realtime-sales-copilot\memory\` — usar para:
- Status de configuração externa (Deepgram, Anthropic, Langfuse)
- Notas sobre o corpus (arquivos descartados, taxonomias)
- Feedback do usuário sobre approach (corrigir vs validar)

Não usar para: estado do código (vive no git), tasks (vive em todos), conteúdo da Constitution (vive em `.claude/CONSTITUTION.md`).
