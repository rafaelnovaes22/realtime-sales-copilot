/**
 * Relatório de acompanhamento do aprendizado — montagem dos indicadores +
 * drift por janela. Usado pelo script (gera markdown) e pelo endpoint (JSON).
 *
 * C4: nada muda sozinho. O relatório recomenda; um humano decide a intervenção.
 */

import { fetchLearningRows, type LearningRow } from "./store.js";
import {
  computeIndicators,
  indicatorsByDimension,
  detectDrift,
  type Indicators,
  type DriftFlag,
} from "./metrics.js";

export type WindowPair = { atual: Indicators; anterior: Indicators };

export type LearningReport = {
  generatedAt: string;
  windowDays: number;
  total: number;
  overall: WindowPair;
  byTipo: Array<{ chave: string } & WindowPair>;
  byCloser: Array<{ chave: string } & WindowPair>;
  drift: DriftFlag[];
};

export async function buildReport(opts?: {
  windowDays?: number;
  nowMs?: number;
}): Promise<LearningReport> {
  const windowDays = opts?.windowDays ?? 7;
  const nowMs = opts?.nowMs ?? Date.now();
  const cutoff = nowMs - windowDays * 24 * 60 * 60 * 1000;

  const rows = await fetchLearningRows(windowDays * 2);
  const atualRows = rows.filter((r) => new Date(r.ts).getTime() >= cutoff);
  const anteriorRows = rows.filter((r) => new Date(r.ts).getTime() < cutoff);

  const tipoKey = (r: LearningRow) => r.tipo;
  const closerKey = (r: LearningRow) => r.closer_id;

  const tipoAtual = indicatorsByDimension(atualRows, tipoKey);
  const tipoAnterior = indicatorsByDimension(anteriorRows, tipoKey);
  const closerAtual = indicatorsByDimension(atualRows, closerKey);
  const closerAnterior = indicatorsByDimension(anteriorRows, closerKey);

  const drift = [
    ...detectDrift(tipoAtual, tipoAnterior, "tipo"),
    ...detectDrift(closerAtual, closerAnterior, "closer"),
  ];

  const pair = (
    atualMap: Map<string, Indicators>,
    anteriorMap: Map<string, Indicators>,
  ): Array<{ chave: string } & WindowPair> =>
    [...atualMap.keys()].map((chave) => ({
      chave,
      atual: atualMap.get(chave)!,
      anterior: anteriorMap.get(chave) ?? computeIndicators([]),
    }));

  return {
    generatedAt: new Date(nowMs).toISOString(),
    windowDays,
    total: rows.length,
    overall: {
      atual: computeIndicators(atualRows),
      anterior: computeIndicators(anteriorRows),
    },
    byTipo: pair(tipoAtual, tipoAnterior),
    byCloser: pair(closerAtual, closerAnterior),
    drift,
  };
}

/** Renderiza o relatório como markdown para docs/foundry/learning-reports/. */
export function renderReportMarkdown(r: LearningReport): string {
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  const lines: string[] = [];
  lines.push(`# Relatório de Acompanhamento — Aprendizado do co-pilot`);
  lines.push("");
  lines.push(`Gerado em: ${r.generatedAt} · Janela: ${r.windowDays} dias · Eventos: ${r.total}`);
  lines.push("");

  lines.push(`## Visão geral (janela atual vs anterior)`);
  lines.push("");
  lines.push(`| Métrica | Atual | Anterior |`);
  lines.push(`|---|---|---|`);
  const o = r.overall;
  lines.push(`| Eventos | ${o.atual.n} | ${o.anterior.n} |`);
  lines.push(`| Aceitação | ${pct(o.atual.agreementRate)} | ${pct(o.anterior.agreementRate)} |`);
  lines.push(`| Edição (sobre aceitas) | ${pct(o.atual.editRate)} | ${pct(o.anterior.editRate)} |`);
  lines.push(`| Dispensa | ${pct(o.atual.dismissRate)} | ${pct(o.anterior.dismissRate)} |`);
  lines.push(`| Outcome won/advanced | ${o.atual.outcomeWonAdvanced} | ${o.anterior.outcomeWonAdvanced} |`);
  lines.push(`| Latência média | ${o.atual.avgLatencyMs}ms | ${o.anterior.avgLatencyMs}ms |`);
  lines.push("");

  lines.push(`## Por tipo de objeção (atual)`);
  lines.push("");
  lines.push(`| Tipo | n | Aceitação | Edição | Won/Adv |`);
  lines.push(`|---|---|---|---|---|`);
  for (const t of r.byTipo.sort((a, b) => b.atual.n - a.atual.n)) {
    lines.push(
      `| ${t.chave} | ${t.atual.n} | ${pct(t.atual.agreementRate)} | ${pct(t.atual.editRate)} | ${t.atual.outcomeWonAdvanced} |`,
    );
  }
  lines.push("");

  lines.push(`## Indicador de mudança (drift) → intervenção recomendada`);
  lines.push("");
  if (r.drift.length === 0) {
    lines.push(`Nenhum drift acima do limiar nesta janela. ✅`);
  } else {
    for (const f of r.drift) {
      lines.push(`- **${f.dimensao}** (${f.metrica}): ${pct(f.anterior)} → ${pct(f.atual)}. ${f.recomendacao}`);
    }
  }
  lines.push("");
  lines.push(`> C4: este relatório recomenda. A alteração de prompt/corpus é decidida por um humano e aplicada via gate (loop offline).`);
  lines.push("");
  return lines.join("\n");
}
