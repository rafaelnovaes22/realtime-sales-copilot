/**
 * Gera o relatório de acompanhamento do aprendizado e o persiste em
 * docs/forge/learning-reports/{data}.md. Cadência sugerida: semanal (cron) +
 * execução sob demanda. Imprime as recomendações de intervenção no console.
 *
 * Uso: npm run learning:report  (ou tsx --env-file=.env scripts/learning-report.ts)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildReport, renderReportMarkdown } from "../apps/api/src/learning/report.js";

const OUT_DIR = "docs/forge/learning-reports";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL ausente — sem dados de feedback para o relatório.");
    process.exit(1);
  }

  const windowDays = Number(process.argv[2] ?? 7);
  const report = await buildReport({ windowDays });
  const md = renderReportMarkdown(report);

  mkdirSync(OUT_DIR, { recursive: true });
  const date = report.generatedAt.slice(0, 10);
  const path = resolve(OUT_DIR, `${date}.md`);
  writeFileSync(path, md, "utf8");

  console.log(`✓ Relatório gerado: ${path}`);
  console.log(`  Eventos: ${report.total} · Aceitação atual: ${(report.overall.atual.agreementRate * 100).toFixed(0)}%`);
  if (report.drift.length === 0) {
    console.log("  Drift: nenhum acima do limiar. ✅");
  } else {
    console.log(`  ⚠️  ${report.drift.length} drift(s) — intervenção recomendada:`);
    for (const f of report.drift) console.log(`    - ${f.recomendacao}`);
  }
}

main().catch((err) => {
  console.error("learning-report falhou:", err);
  process.exit(1);
});
