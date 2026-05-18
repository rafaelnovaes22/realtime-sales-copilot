# Roadmap — Acme Forja Comercial

**Status atual:** aguardando aprovação para iniciar Step 0.

## Visão geral

```
FUNDAÇÃO          PRODUTO           VALIDAÇÃO         APRENDIZADO       PRODUÇÃO
Semanas 1-5  →   Semanas 6-10  →   Semanas 10-12  →  Semanas 13-15  →  contínuo

Step 0            Step 5            SHADOW            Step 8            Step 10
Step 1            Step 6            Step 7            Step 9            AUTONOMOUS
Step 2
Step 3
Step 4
```

---

## Fase 1 — Fundação (semanas 1-5)

### Step 0 — Decisões, setup e LGPD (semana 1)
- Travar decisões de stack (ADR-001)
- Criar repo e instalar agent-governance-framework
- Redigir e aprovar texto de consentimento LGPD (ADR-002)
- Definir constitution-extension com guardrails de domínio
- **Saída:** projeto criado, regras definidas, LGPD aprovado pelo jurídico

### Step 1 — Ingest e normalização do corpus (semanas 2-2,5)
- Ler 6 arquivos fonte, corrigir encoding (mojibake crítico)
- Parse Markdown → AST → chunks por heading
- Output: `corpus.raw.json` com provenance por chunk
- **Saída:** corpus bruto estruturado, sem caracteres corrompidos

### Step 2 — Dedup, sanitização e tagging (semanas 2,5-4)
- Descartar arquivo B (subset de C)
- Reduzir arquivo A a taxonomia de temas
- Aplicar `brand-glossary.json` (zero termos proprietários)
- Tagging de cada chunk: `estado_aplicavel`, `gatilho_relacionado`, `tipo_sugestao`
- Gerar embeddings (pgvector)
- Gate: revisão humana de amostra com closer sênior
- **Saída:** `corpus.clean.json` brand-free, tagged, pronto para retrieval em tempo real

### Step 3 — Taxonomias operacionais (semanas 4-4,5)
- `estados.json` — estados canônicos da conversa (abertura → encerramento)
- `gatilhos.json` — lista de gatilhos com heurísticas de base
- Glossário SPIN, KPIs e checklists sem termos proprietários
- **Saída:** vocabulário operacional do co-pilot definido

### Step 4 — Eval-cases (semanas 4,5-5,5)
- 50 cenários de ligação simulando situações reais
  - 20 trechos de transcrição + estado + gatilho + sugestão esperada
  - 10 cenários de objeção
  - 10 cenários de gatilho de perfil
  - 5 cases negativos (não deve sugerir)
  - 5 cases de leakage (deve recusar)
- **Saída:** `evals/v1/` com suite de testes para CI

---

## Fase 2 — Produto (semanas 6-10)

### Step 5 — Backend: captura, STT e orquestração (semanas 6-8)
*Caminho crítico — define a viabilidade técnica do produto*

- Bot Recall.ai integrado (captura áudio diarizado de Zoom/Meet)
- Deepgram STT streaming PT-BR (<300ms)
- Orquestrador WebSocket:
  - Detector de estado (Haiku 4.5)
  - Detector de gatilho (Haiku 4.5, paralelo)
  - Gerador de sugestão (Sonnet 4.6, só quando gatilho dispara)
  - Guardian (regex + Haiku 4.5)
- Schema Postgres + auth + deploy Railway
- Gate técnico: **p95 latência < 3s em chamada de teste**
- **Saída:** motor funcionando com áudio simulado (playback de gravação)

### Step 6 — Frontend: painel co-pilot (semanas 8-10, overlap parcial)
- Next.js 14+ + Tailwind + shadcn/ui
- `/chamada/[id]` — painel ao vivo:
  - Transcrição streaming (esquerda)
  - Estado atual + barra de progresso SPIN (topo)
  - Cards de sugestão com 👍/👎/✓dispensar (direita)
  - Alertas de processo
- `/historico` — replay de ligações passadas
- `/admin/gaps` — dashboard do gestor
- Componente LGPD (pop-up + registro de consentimento)
- PWA (instalável no desktop do closer)
- **Saída:** site com login + co-pilot funcional em chamadas reais

---

## Fase 3 — Validação (semanas 10-12)

### SHADOW — 3-5 closers em paralelo ao processo atual
- Closers usam o co-pilot ao lado do processo que já fazem
- Métricas de aprovação:
  - ≥70% de sugestões marcadas como úteis
  - Zero leakage de marca
  - p95 latência < 3s
  - Zero falhas de captura de áudio

### Step 7 — Pós-call e CRM (semana 12)
- Worker pós-chamada:
  - Resumo da ligação (Sonnet 4.6)
  - Draft de follow-up (WhatsApp/e-mail)
  - Registro de indicações pedidas/recebidas
  - Sinais de qualidade (aderência ao SPIN, tempo de fala, perguntas vs afirmações)
- Integração com CRM (a definir no Step 0)
- **Saída:** follow-up automático ≤1h após encerramento da chamada

---

## Fase 4 — Aprendizado contínuo (semanas 13-15)

### Step 8 — Eval automático + correlação com outcome (semanas 13-14)
- Worker noturno: Sonnet-juiz pontua cada sugestão (0-5)
- Cruza com feedback humano (👍/👎) e resultado real (fechou? avançou?)
- Cluster de gaps: onde o sistema está falhando?
- Dashboard `/admin/gaps`
- **Saída:** gaps identificados quantitativamente, correlação sugestão × resultado

### Step 9 — Self-harness com gate humano (semanas 13-15)
- Worker propõe melhorias (novo cenário, ajuste de prompt, novo gatilho)
- Delta vira PR no GitHub
- UI `/admin/refinos` mostra diff + amostra dos turns problemáticos
- Aprovação humana → CI/CD → deploy automático
- Modo treinamento offline (P2) desbloqueado
- Gate ASSISTED: ≥75% úteis (média móvel), lift de conversão mensurável
- **Saída:** pipeline de melhoria contínua operando

---

## Fase 5 — Produção (contínuo)

### Step 10 — AUTONOMOUS + coaching do gestor
- Promoção para lifecycle AUTONOMOUS (agent-governance-framework)
- `/coaching` — gestor vê evolução por closer, heatmap de etapas perdidas
- Auditoria trimestral de leakage
- Playbook de melhores práticas extraído automaticamente
- Multi-tenant: possibilidade de escalar para corretoras parceiras
- Migração Railway → GCP

---

## Cronograma consolidado

| Step | Duração | Semana início | Semana fim |
|---|---|---|---|
| 0. Setup + LGPD | 1 sem | 1 | 1 |
| 1. Ingest corpus | 0,5-1 sem | 2 | 2,5 |
| 2. Dedup + sanitização + tagging | 1,5 sem | 2,5 | 4 |
| 3. Taxonomias | 0,5-1 sem | 4 | 4,5 |
| 4. Eval-cases | 1 sem | 4,5 | 5,5 |
| 5. Backend MVP | 2-3 sem | 6 | 8 |
| 6. Frontend co-pilot | 2 sem (overlap) | 8 | 10 |
| SHADOW | 1 sem | 10 | 11 |
| 7. Pós-call + CRM | 1 sem | 11 | 12 |
| 8. Eval automático | 1-2 sem | 13 | 14 |
| 9. Self-harness | 2-3 sem | 13 | 15 |
| 10. AUTONOMOUS | contínuo | 16 | — |

**Total até MVP em produção com closers reais: ~10 semanas**
**Total até self-harness operando: ~15 semanas**

## Caminho crítico

**Step 5 (backend)** — captura + STT + orquestração em tempo real. Se a latência não ficar abaixo de 3s, o produto inteiro não funciona. Validar cedo.
