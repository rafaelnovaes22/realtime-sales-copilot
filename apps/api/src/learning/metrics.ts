/**
 * Indicadores de aprendizado + detecção de mudança (drift).
 *
 * Funções puras (sem DB) sobre LearningRow[] — testáveis isoladamente.
 * O "indicador de mudança" compara janela atual vs anterior e sinaliza quando
 * um limiar é cruzado, alimentando o relatório de acompanhamento (intervenção
 * humana — C4: nada muda sozinho).
 */

import type { LearningRow } from "./store.js";

export type Indicators = {
  n: number;
  agreementRate: number; // accepted / n
  dismissRate: number; // dismissed / n
  rejectRate: number; // rejected / n
  editRate: number; // was_edited / accepted
  avgEditDistance: number; // média sobre aceitas editadas
  outcomeWonAdvanced: number; // contagem com outcome won|advanced
  avgLatencyMs: number;
};

export type DriftFlag = {
  dimensao: string; // ex: "tipo:preco"
  metrica: "agreement_rate" | "edit_rate";
  anterior: number;
  atual: number;
  deltaPP: number; // pontos percentuais (negativo = piora p/ agreement)
  recomendacao: string;
};

// Limiares configuráveis (C8 — sem hardcode oculto). Override por env.
export const AGREEMENT_DROP_PP = Number(process.env.LEARN_AGREEMENT_DROP_PP ?? 0.15);
export const EDIT_RISE_PP = Number(process.env.LEARN_EDIT_RISE_PP ?? 0.15);
export const MIN_N = Number(process.env.LEARN_MIN_N ?? 10);

export function computeIndicators(rows: LearningRow[]): Indicators {
  const n = rows.length;
  if (n === 0) {
    return {
      n: 0,
      agreementRate: 0,
      dismissRate: 0,
      rejectRate: 0,
      editRate: 0,
      avgEditDistance: 0,
      outcomeWonAdvanced: 0,
      avgLatencyMs: 0,
    };
  }
  const accepted = rows.filter((r) => r.action === "accepted");
  const dismissed = rows.filter((r) => r.action === "dismissed").length;
  const rejected = rows.filter((r) => r.action === "rejected").length;
  const edited = accepted.filter((r) => r.was_edited === true);
  const editDistances = edited
    .map((r) => r.edit_distance ?? 0)
    .filter((d) => d > 0);
  const won = rows.filter((r) => r.outcome === "won" || r.outcome === "advanced").length;
  const latencies = rows.map((r) => r.latency_ms ?? 0).filter((l) => l > 0);

  return {
    n,
    agreementRate: accepted.length / n,
    dismissRate: dismissed / n,
    rejectRate: rejected / n,
    editRate: accepted.length > 0 ? edited.length / accepted.length : 0,
    avgEditDistance: editDistances.length > 0 ? avg(editDistances) : 0,
    outcomeWonAdvanced: won,
    avgLatencyMs: latencies.length > 0 ? Math.round(avg(latencies)) : 0,
  };
}

/** Agrupa linhas por uma dimensão (tipo, closer) e computa indicadores por grupo. */
export function indicatorsByDimension(
  rows: LearningRow[],
  key: (r: LearningRow) => string | null,
): Map<string, Indicators> {
  const groups = new Map<string, LearningRow[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const arr = groups.get(k) ?? [];
    arr.push(r);
    groups.set(k, arr);
  }
  const out = new Map<string, Indicators>();
  for (const [k, arr] of groups) out.set(k, computeIndicators(arr));
  return out;
}

/**
 * Compara duas janelas por dimensão e emite flags de drift quando um limiar é
 * cruzado (queda de aceitação ou alta de edição), com amostra mínima MIN_N.
 */
export function detectDrift(
  atual: Map<string, Indicators>,
  anterior: Map<string, Indicators>,
  prefixo: string,
): DriftFlag[] {
  const flags: DriftFlag[] = [];
  for (const [dim, ind] of atual) {
    const prev = anterior.get(dim);
    if (!prev || ind.n < MIN_N || prev.n < MIN_N) continue;

    const dAgree = ind.agreementRate - prev.agreementRate;
    if (dAgree <= -AGREEMENT_DROP_PP) {
      flags.push({
        dimensao: `${prefixo}:${dim}`,
        metrica: "agreement_rate",
        anterior: prev.agreementRate,
        atual: ind.agreementRate,
        deltaPP: dAgree,
        recomendacao: `Aceitação caiu ${pp(dAgree)} em ${prefixo} '${dim}'. Revisar prompt-hint/corpus desse caso.`,
      });
    }

    const dEdit = ind.editRate - prev.editRate;
    if (dEdit >= EDIT_RISE_PP) {
      flags.push({
        dimensao: `${prefixo}:${dim}`,
        metrica: "edit_rate",
        anterior: prev.editRate,
        atual: ind.editRate,
        deltaPP: dEdit,
        recomendacao: `Closers estão reescrevendo mais (+${pp(dEdit)}) em ${prefixo} '${dim}'. A sugestão está perto, mas errando o tom/conteúdo — revisar.`,
      });
    }
  }
  return flags;
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function pp(frac: number): string {
  return `${(frac * 100).toFixed(0)}pp`;
}
