---
diagnostic_code: "live-suggestion-copilot"
target_client: "acme-internal"
status: "retroactive"
fee_brl: 0
delivery_days: 0
constitution_version: "0.3.0"
linked_proposal: null
linked_unit_economics: null
linked_spec: "docs/specs/live-suggestion-copilot.md"
owners:
  consultant: "Rafael Novaes (Acme)"
  technical_reviewer: "(pendente)"
created_at: "2026-05-19"
delivered_at: "2026-05-19"
version: "0.1.0"
forge_skill_version: "diagnostic-runner@v0.2.0"
forge_command_version: "diagnose@v0.2.0"
project_type: "agentic_saas"
ai_enabled: true
trace_id: null
retroactive_note: |
  Este diagnóstico é RETROATIVO. O MVP do live-suggestion-copilot foi
  construído como spike técnico em 2026-05-19 antes da formalização C1.
  Os blocos de baseline humano e custo do não-resolvido contêm campos
  marcados TBD que devem ser preenchidos via entrevista com 2-3 closers
  seniores Acme antes da promoção SHADOW.
  trace_id ausente porque Langfuse ainda não está integrado (débito C6
  declarado em docs/forge/manifest.json).
---

# Diagnostic — live-suggestion-copilot (Acme Internal)

> **Status:** retroativo. Construído após o MVP técnico para cumprir C1
> formalmente. Gaps de baseline declarados explicitamente.
> **Cliente:** Acme (interno — closers próprios)
> **Módulo alvo:** `live-suggestion-copilot` (declarado em docs/forge/project.json)

---

## Bloco 1 — Problema declarado

**Frase ipsis literis** (inferida do README + roadmap; pendente validação com decisor):

> "Closers Acme perdem oportunidades por: pular etapas do diagnóstico (SPIN),
> responder mal a objeções comuns ('vou pensar', 'está caro', 'prefiro
> investir', 'já tenho seguro'), apresentar produto antes de identificar a
> necessidade real, e esquecer de pedir indicação ao final da conversa.
> Treinamento presencial e role play semanal não escalam, e o gestor não
> consegue acompanhar 100 ligações por semana."

### Contexto adicional levantado dos materiais do projeto

- O closer atende ligações ao vivo (Zoom/Meet) com prospects e clientes.
- A operação tem closers em níveis diferentes de senioridade.
- Existe corpus extenso de material de treinamento (50+ aulas com diálogos
  e role plays) que hoje só é consumido offline em treinamentos.
- A revisão de qualidade depende do gestor escutar gravações pós-call,
  sem cadência consistente.

---

## Bloco 2 — Custo do não-resolvido (humano + operacional)

| Item | Estimativa | Status |
|---|---|---|
| Closer ramp-up sem co-pilot | TBD meses (típico mercado: 3-6) | **TBD — entrevistar gestor** |
| Conversão SQL→fechamento de closer médio vs sênior | TBD% vs TBD% | **TBD — extrair do CRM** |
| Ligações revisadas pelo gestor por semana | TBD de N totais | **TBD — entrevistar gestor** |
| Custo de uma sugestão errada do gestor pós-call (ciclo lento) | Demora 1-3 dias para feedback chegar ao closer | Inferido |
| Custo de leakage de marca em ligação ao vivo | Risco jurídico + IP — alto, incalculável | Declarado em ADR-002 |

**Conclusão**: o custo principal não é monetário direto; é **velocidade de
aprendizado do closer** e **consistência de método entre closers**. Co-pilot
em tempo real comprime o ciclo de feedback de "dias pós-call" para
"≤3s durante a call".

---

## Bloco 3 — Baseline humano

### Modelo atual de suporte ao closer durante a ligação

| Recurso | Disponibilidade durante a call |
|---|---|
| Material de treinamento | Indisponível (memorizado pelo closer) |
| Gestor escutando ao vivo | Apenas em ligações marcadas para coaching |
| Anotações próprias do closer | Sim, mas distrai e atrasa |
| Roteiro/script | Sim, mas é rígido e o cliente percebe |
| Co-piloto humano | Não existe em escala |

### Custo unitário hoje (a medir)

| Métrica | Valor | Como medir |
|---|---|---|
| Custo de uma hora-closer (salário + encargos) | TBD R$/h | RH Acme |
| Tempo médio de ligação consultiva | TBD min | CRM / gravações |
| Taxa de conversão atual (SQL → contratado) | TBD % | CRM |

**Gap explícito**: baseline humano não foi medido. Antes de SHADOW, rodar
entrevista de 60min com 2-3 closers seniores + análise de 10 gravações
recentes para preencher.

---

## Bloco 4 — Tentativas anteriores

| Tentativa | Resultado | Por que não resolveu |
|---|---|---|
| Treinamento presencial recorrente | Cobre fundamentos, mas dispersa no campo | Conhecimento vira "lembrança", não ação no momento certo |
| Role play semanal entre closers | Bom para musculatura, ruim para casos novos | Não cobre toda a taxonomia de objeções/gatilhos |
| Gravação + revisão pós-call pelo gestor | Feedback lento e amostral | Ciclo de aprendizado dias→semanas, não real-time |
| Scripts rígidos | Closer fica robótico, cliente percebe | Mata venda consultiva (decisão D004 do projeto) |

**Hipótese central**: nenhuma tentativa anterior opera em tempo real
durante a ligação. Co-pilot ataca exatamente esse gap.

---

## Bloco 5 — Outcome candidato (agentic_saas → classified_outcome)

### Cláusula contratual proposta

> "Co-pilot emite **sugestão curta** (1-2 linhas, ≤280 chars, zero brand
> leakage) ao closer em **≤3s após detecção de gatilho do cliente**.
> Cada sugestão é classificada por estado da conversa (abertura,
> diagnóstico, apresentação, objeção, fechamento) e gatilho específico
> (vou_pensar, está_caro, prefiro_investir, já_tenho_seguro, etc.).
> Em modo SHADOW, mede-se a **taxa de aceitação** do closer (👍 ou uso
> efetivo da fala em <30s da emissão) sobre o total de sugestões emitidas."

### 3 exemplos POSITIVOS (sugestão deve ser emitida)

1. **Cliente fala "está caro" em estado=apresentação** → sugestão isola
   objeção entre orçamento vs valor (testado: *"O desconforto é com o
   valor em si ou ainda tem dúvida se a proteção faz sentido pro seu
   caso?"*)
2. **Cliente fala "vou pensar" em estado=fechamento** → sugestão qualifica
   o "pensar" (testado: *"O que exatamente você quer pensar: o valor, a
   cobertura ou a decisão em si?"*)
3. **Cliente fala "prefiro investir em CDB" em estado=apresentação** →
   sugestão diferencia função investimento vs proteção (testado:
   *"CDB constrói patrimônio com o tempo. Se acontecer algo antes de o
   saldo chegar lá, quem cobre o gap pra sua família?"*)

### 3 exemplos NEGATIVOS (sugestão NÃO deve ser emitida)

1. **Cliente conversa livremente sobre a família sem objeção** → não emitir
   (testado: cenário "minha esposa e dois filhos" → 0ms, zero gatilho detectado)
2. **Closer acabou de fazer pergunta aberta e cliente ainda processando** →
   não emitir (regra de timing — não interromper janela de resposta do
   cliente)
3. **Estado=encerramento e decisão já tomada** → não emitir (regra do
   constitution-extension)

### Trigger event técnico de DELIVERED

```
suggestion.emitted   → card aparece na tela do closer
suggestion.accepted  → closer marcou 👍 OU usou a fala (NLP match
                       parcial no áudio ≤30s da emissão)
suggestion.dismissed → closer marcou ✓ dispensar
suggestion.ignored   → 60s sem interação após emissão
suggestion.blocked   → guardian rejeitou (brand leak / tamanho)
```

**audit_log_event_expected**: `suggestion_emitted` em Langfuse com
trace_id, gatilho detectado, chunks usados, texto gerado, status final
do closer (accepted/dismissed/ignored), latência fim-a-fim, custo de
tokens.

---

## Bloco 6 — Métrica de sucesso

| Métrica | Threshold SHADOW | Threshold ASSISTED | Threshold AUTONOMOUS |
|---|---|---|---|
| `latency_p95_ms` | ≤ 3000 | ≤ 2500 | ≤ 2000 |
| `brand_leak_rate` | 0 (hard gate) | 0 | 0 |
| `agreement_rate` (accepted / emitted) | ≥ 50% | ≥ 70% | ≥ 80% |
| `false_positive_rate` (emitted sem motivo legítimo) | ≤ 10% | ≤ 5% | ≤ 3% |
| `coverage` (gatilhos cobertos pelo detector) | ≥ 70% dos gatilhos do corpus | ≥ 85% | ≥ 95% |
| `closer_lift` (conversão closer com co-pilot vs sem) | medir, sem threshold | ≥ +5pp | ≥ +10pp |

**Status atual** (sem closers reais, validação CLI sintética):
- `latency_p95_ms` = 2778ms ✅
- `brand_leak_rate` = 0 ✅ (validado por grep em sanitize.ts output)
- Resto: não medido (sem SHADOW ainda).

---

## Bloco 7 — Tolerância a erro

| Tipo de erro | Tolerância | Mitigação atual |
|---|---|---|
| Brand leak em sugestão emitida | **Zero** (LGPD + IP) | 3 camadas: corpus sanitizado + system prompt + guardian regex |
| Latência >3s | Baixa (closer perde momento) | Sonnet 4.6 com prompt cache; sem retrieval semântico no MVP |
| Sugestão em momento errado | Média (closer ignora ou dismissa) | Detector regex conservador; estado da conversa como filtro |
| Sugestão semanticamente errada | Média | Retrieval só pega chunks com tag de gatilho match |
| Falha de transcrição | Baixa-média (Deepgram robusto) | Modelo nova-3 + PT-BR + interim_results |
| Sugestão expõe dado pessoal do cliente | **Zero** | Sugestões nunca incluem PII; corpus não tem PII |

---

## Bloco 8 — ICP fit (interno)

| Critério ICP Acme | Resultado |
|---|---|
| PME R$2M+ com CEO bombeiro | Acme é a própria empresa — fit por construção |
| Caos operacional / falta de processo | Operação comercial dependente de método consistente |
| Outcome cobrável claro | Conversão SQL→fechamento; agreement_rate; closer_lift |
| Disposição a pagar | Cliente interno, sem barreira comercial |

**Resultado:** `fit` (cliente interno, primeiro consumidor do co-pilot).

---

## Bloco 9 — Catálogo fit (interno)

- **SKU existente?** Não. Este é um agente novo no catálogo Acme.
- **Variante de SKU existente?** Não.
- **Novo SKU?** Sim. Nome proposto: `live-suggestion-copilot`.

**Resultado:** `new` — criar SKU vertical novo via `/acme:spec --type=platform-sku`.

---

## Bloco 10 — Próximos passos

### GO / NO-GO

**Decisão:** `GO` (com gates).

### Justificativa

1. Cliente interno, ICP fit, sem fricção comercial.
2. Outcome cobrável bem definido (agreement_rate em SHADOW).
3. Custo técnico viável (validado: pipeline funciona em <3s, ~R$ 0,01
   por sugestão estimado em Haiku+Sonnet).
4. Risco principal (brand leak) tem 3 camadas de mitigação.
5. MVP técnico já existe e atende SLA preliminar.

### Gates a cumprir antes de SHADOW

- [ ] Entrevistar 2-3 closers seniores Acme (60min cada) — preencher
      gaps de baseline (Bloco 3).
- [ ] Analisar 10 gravações de ligação real para validar taxonomia de
      gatilhos do `gatilhos.ts` (atualmente 10 regex; pode precisar +/-).
- [ ] Integrar Langfuse no `generator.ts` (débito C6).
- [ ] Mover Anthropic SDK para `src/llm/` (débito C7).
- [ ] Rodar `/acme:spec --type=platform-sku --client_id=acme-internal
      --artifact_id=live-suggestion-copilot`.
- [ ] Rodar `/acme:unit-economics --artifact_id=live-suggestion-copilot`.
- [ ] Definir `/acme:sla-threshold` formal (já temos os números deste
      diagnóstico, falta o gate formal).
- [ ] LGPD: texto de consentimento aprovado pelo jurídico
      (ADR-002 dependente).

### Próxima command sugerida

```
/acme:spec --type=platform-sku --client_id=acme-internal \
             --artifact_id=live-suggestion-copilot
```

---

## Verification gate (do command /acme:diagnose)

- [x] 10 blocos preenchidos (gaps marcados TBD com plano de coleta)
- [x] `proposed_outcome.clause` presente
- [x] ≥3 exemplos positivos + ≥3 exemplos negativos
- [x] `trigger_event` declarado
- [x] `icp_fit = fit` declarado e justificado
- [x] `go_no_go = go` declarado com justificativa e gates
- [x] Arquivo persistido em `docs/clients/acme-internal/`
- [ ] `trace_id` não-nulo — **GAP**: Langfuse não integrado (débito C6)
- [x] Nenhuma leitura de Tier 3 (runs/outcomes/eval-cases/traces)

**Status final do diagnóstico**: `partial` — produzido retroativamente,
com 1 gate falhando (trace_id ausente por débito C6). Será reauditado
após integração Langfuse.

---

## Output structured (para a próxima command)

```yaml
command: /acme:diagnose
status: partial
client_id: acme-internal
artifact_path: docs/clients/acme-internal/diagnostic-live-suggestion-copilot.md
project_type: agentic_saas
ai_enabled: true
session_minutes_actual: 0  # retroativo
icp_fit: fit
catalog_fit: new
go_no_go: go
proposed_outcome:
  kind: classified_outcome
  clause: "Co-pilot emite sugestão curta (≤280 chars, sem brand leak) ao closer em ≤3s após detecção de gatilho, e closer aceita/usa em ≥70% dos casos durante SHADOW."
  positive_examples:
    - "Cliente 'está caro' em apresentação → isola objeção valor vs orçamento"
    - "Cliente 'vou pensar' em fechamento → qualifica o que pensar"
    - "Cliente 'prefiro investir CDB' em apresentação → diferencia função investimento vs proteção"
  negative_examples:
    - "Cliente conversa sobre família sem objeção → não emitir"
    - "Closer fez pergunta aberta, cliente processando → não emitir"
    - "Estado=encerramento e decisão tomada → não emitir"
  trigger_event: "suggestion.accepted | suggestion.dismissed | suggestion.ignored | suggestion.blocked"
  audit_log_event_expected: "suggestion_emitted"
baseline_handoff:
  model: human_baseline
  ready_for: "/acme:spec --type=platform-sku --client_id=acme-internal --artifact_id=live-suggestion-copilot"
  fields_collected:
    - "stack técnico (Anthropic Sonnet 4.6 + Haiku 4.5 + Deepgram nova-3)"
    - "pipeline 4-stage (detector + retriever + generator + guardian)"
    - "latency_p95 = 2778ms (CLI sintético)"
    - "brand_leak_rate = 0 (sanitize + guardian validados)"
  fields_missing:
    - "closer_hourly_cost_brl (RH Acme)"
    - "current_conversion_rate (CRM)"
    - "calls_reviewed_by_gestor_weekly (entrevista gestor)"
    - "ramp_up_time_new_closer (entrevista gestor)"
trace_id: null
generated_at: 2026-05-19T00:00:00Z
next_step: "/acme:spec --type=platform-sku --client_id=acme-internal --artifact_id=live-suggestion-copilot"
```
