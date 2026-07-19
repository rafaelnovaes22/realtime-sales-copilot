---
artifact_id: "live-suggestion-copilot"
prompt_version: "1.0.0"
prompt_hash: "b79c0cdf8b65efe7"
ran_at: "2026-05-20T00:00:00Z"
ran_by: "Rafael Novaes / /novais-digital:eval"
total_cases: 50
subset_filter: "seed — estruturação inicial da suite"
adapter_provider: "anthropic"
target_model: "claude-sonnet-4-6"
judge_model: "claude-haiku-4-5"
total_cost_usd: 0
total_latency_seconds: 0
foundry_command_version: "eval@0.1.0"
linked_principles: ["C2", "C4", "C6"]
status: "partial"
note: "Run de estruturação — casos criados e validados por humano (curador). Execução automática via runner pendente de implementação."
---

# Eval Report — live-suggestion-copilot / Seed Run

> **Status: PARTIAL** — suite seeded, runner não wired ainda. Casos foram validados por curador humano (Rafael Novaes).

---

## Resultado global

- Total de casos: **50**
- Executados automaticamente: **0** (runner pendente)
- Validados por curador humano: **50/50**
- Threshold C4 (30/categoria): **NÃO ATINGIDO** — 5 por categoria vs 30 exigidos
- **Status: PARTIAL** (não bloqueia SHADOW, mas exige completar suite antes de promover)

---

## Cobertura por categoria

| Categoria | Casos | DELIVERED | SKIPPED | Source mix | C4 gate (30) |
|---|---|---|---|---|---|
| `vou_pensar` | 5 | 4 | 1 | 3 synthetic / 1 edge / 1 adversarial | ❌ 5/30 |
| `esta_caro` | 5 | 4 | 1 | 3 synthetic / 1 edge / 1 adversarial | ❌ 5/30 |
| `prefiro_investir` | 5 | 4 | 1 | 3 synthetic / 1 edge / 1 adversarial | ❌ 5/30 |
| `ja_tenho_seguro` | 5 | 4 | 1 | 3 synthetic / 1 edge / 1 adversarial | ❌ 5/30 |
| `quero_pesquisar` | 5 | 4 | 1 | 3 synthetic / 1 edge / 1 adversarial | ❌ 5/30 |
| `falar_com_conjuge` | 5 | 4 | 1 | 3 synthetic / 1 edge / 1 adversarial | ❌ 5/30 |
| `sem_tempo_agora` | 5 | 4 | 1 | 3 synthetic / 1 edge / 1 adversarial | ❌ 5/30 |
| `desconfianca_seguradora` | 5 | 4 | 1 | 3 synthetic / 1 edge / 1 adversarial | ❌ 5/30 |
| `apresentacao_premium_alto` | 5 | 4 | 1 | 3 synthetic / 2 edge | ❌ 5/30 |
| `fechamento_estagnado` | 5 | 4 | 1 | 3 synthetic / 1 edge / 1 adversarial | ❌ 5/30 |
| **TOTAL** | **50** | **40** | **10** | — | ❌ 50/300 |

---

## Próximos passos para completar C4

Para atingir o gate obrigatório de 30 casos por categoria (= 300 total):

| Ação | Quantidade | Fonte prioritária |
|---|---|---|
| Casos adicionais por categoria | +25/categoria = +250 total | Transcrições reais anonimizadas de closers Novais Digital |
| Mix obrigatório (C4): ≤ 40% sintético | Máx 120 sintéticos nos 300 | Restante = real/edge/adversarial |
| Casos reais (pós-SHADOW seed) | +180 mínimo | Gravações de closers em SHADOW aprovadas pelo curador |

**Caminho prático antes de SHADOW:**
1. Completar 30 casos nas 4 categorias mais críticas: `esta_caro`, `vou_pensar`, `falar_com_conjuge`, `fechamento_estagnado`
2. Implementar runner automático (`scripts/eval-runner.ts`)
3. Executar eval real e produzir report com métricas de latência e custo

---

## Runner — pendente de implementação

O runner deve:
- Chamar `POST /api/suggest` para cada caso com `expected_outcome_status: DELIVERED`
- Invocar Haiku 4.5 como judge com a rubrica do gabarito
- Verificar que casos `SKIPPED` não geram card
- Medir latência e custo por caso
- Produzir relatório com pass rate por categoria
