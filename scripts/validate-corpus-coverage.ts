/**
 * Valida a cobertura do corpus contra os 18 gatilhos canônicos.
 *
 * Gate (read-only, sem LLM): FALHA (exit 1) se algum gatilho tiver
 * menos de MIN_CHUNKS chunks OU nenhum chunk do tipo `resposta_objecao`.
 * Lista também gatilhos órfãos (tags que não existem mais em gatilhos.ts).
 *
 * Uso: npm run validate:corpus
 */

import { readFileSync } from "node:fs";

import { GATILHOS } from "../apps/api/src/gatilhos.js";

const CORPUS_PATH = "corpus/clean/corpus.clean.json";
const MIN_CHUNKS = 3;

type Chunk = {
  id: string;
  content: string;
  tags?: { estado: string[]; gatilho: string[]; tipo: string[] };
};

function main() {
  const corpus: Chunk[] = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));
  const canonical = new Set<string>(GATILHOS);

  const countByGatilho = new Map<string, number>();
  const respostaByGatilho = new Map<string, number>();
  const orphans = new Map<string, number>(); // tags fora dos 18 canônicos

  for (const chunk of corpus) {
    const gatilhos = chunk.tags?.gatilho ?? [];
    const tipos = chunk.tags?.tipo ?? [];
    const isResposta = tipos.includes("resposta_objecao");
    for (const g of gatilhos) {
      if (g === "nenhum") continue;
      if (canonical.has(g)) {
        countByGatilho.set(g, (countByGatilho.get(g) ?? 0) + 1);
        if (isResposta) respostaByGatilho.set(g, (respostaByGatilho.get(g) ?? 0) + 1);
      } else {
        orphans.set(g, (orphans.get(g) ?? 0) + 1);
      }
    }
  }

  console.log(`Corpus: ${corpus.length} chunks · ${GATILHOS.length} gatilhos canônicos · MIN=${MIN_CHUNKS}\n`);
  console.log("gatilho                      chunks  resposta_objecao  status");
  console.log("---------------------------- ------  ----------------  ------");

  const failures: string[] = [];
  for (const g of GATILHOS) {
    const n = countByGatilho.get(g) ?? 0;
    const r = respostaByGatilho.get(g) ?? 0;
    const ok = n >= MIN_CHUNKS && r >= 1;
    if (!ok) failures.push(g);
    const status = ok ? "OK" : "FALHA";
    console.log(`${g.padEnd(28)} ${String(n).padStart(6)}  ${String(r).padStart(16)}  ${status}`);
  }

  if (orphans.size > 0) {
    console.log("\nGatilhos ÓRFÃOS (tags fora dos 18 canônicos — precisam de-para/re-tag):");
    for (const [g, n] of [...orphans.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${g}: ${n}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      `\n✗ FALHA: ${failures.length} gatilho(s) sem cobertura mínima: ${failures.join(", ")}`,
    );
    process.exit(1);
  }

  console.log("\n✓ Todos os 18 gatilhos têm cobertura mínima.");
}

main();
