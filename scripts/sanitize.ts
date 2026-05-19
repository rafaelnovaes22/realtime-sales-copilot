/**
 * Sanitize: corpus/raw/corpus.raw.json → corpus/clean/corpus.clean.json
 *
 * 1. Aplica brand-glossary (replacements + wordBoundaryReplacements)
 * 2. Remove linhas que casam com removePatterns
 * 3. Valida com auditCheck — descarta chunks com leakage residual
 * 4. Relatório de substituições e descartes
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const RAW_PATH = "corpus/raw/corpus.raw.json";
const GLOSSARY_PATH = "corpus/glossary/brand-glossary.json";
const OUTPUT_DIR = "corpus/clean";
const OUTPUT_FILE = "corpus.clean.json";

type RawChunk = {
  id: string;
  source: string;
  headingPath: string[];
  level: number;
  content: string;
  position: number;
  charCount: number;
};

type CleanChunk = RawChunk & {
  sanitized: true;
  sanitizationLog: { from: string; to: string; count: number }[];
};

type Glossary = {
  replacements: Record<string, string>;
  wordBoundaryReplacements: Record<string, string>;
  removePatterns: string[];
  auditCheck: string[];
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyReplacements(
  text: string,
  glossary: Glossary,
): { text: string; log: Map<string, { to: string; count: number }> } {
  let out = text;
  const log = new Map<string, { to: string; count: number }>();

  for (const [from, to] of Object.entries(glossary.replacements)) {
    const re = new RegExp(escapeRegex(from), "g");
    const matches = out.match(re);
    if (matches) {
      out = out.replace(re, to);
      log.set(from, { to, count: matches.length });
    }
  }

  for (const [from, to] of Object.entries(glossary.wordBoundaryReplacements)) {
    const re = new RegExp(`\\b${escapeRegex(from)}\\b`, "g");
    const matches = out.match(re);
    if (matches) {
      out = out.replace(re, to);
      log.set(from, { to, count: matches.length });
    }
  }

  return { text: out, log };
}

function applyRemovePatterns(text: string, patterns: string[]): string {
  let out = text;
  for (const pattern of patterns) {
    const re = new RegExp(pattern, "gim");
    out = out.replace(re, "");
  }
  return out
    .split("\n")
    .filter((line, i, arr) => !(line.trim() === "" && arr[i - 1]?.trim() === ""))
    .join("\n")
    .trim();
}

function auditLeakage(text: string, patterns: string[]): string[] {
  const found: string[] = [];
  for (const pattern of patterns) {
    const re = new RegExp(pattern, "gi");
    const matches = text.match(re);
    if (matches) {
      found.push(`${pattern} (${matches.length}x)`);
    }
  }
  return found;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const raw: RawChunk[] = JSON.parse(await readFile(RAW_PATH, "utf8"));
  const glossary: Glossary = JSON.parse(await readFile(GLOSSARY_PATH, "utf8"));

  console.log(`Sanitizando ${raw.length} chunks com glossário v${(glossary as { version?: string }).version ?? "?"}`);

  const clean: CleanChunk[] = [];
  const discarded: { chunk: RawChunk; reason: string }[] = [];
  const totalReplacements = new Map<string, number>();

  for (const chunk of raw) {
    const headingText = chunk.headingPath.join(" / ");

    const { text: sanitizedHeading, log: headingLog } = applyReplacements(headingText, glossary);
    const { text: sanitizedContent, log: contentLog } = applyReplacements(chunk.content, glossary);

    const cleanedContent = applyRemovePatterns(sanitizedContent, glossary.removePatterns);

    if (cleanedContent.length === 0) {
      discarded.push({ chunk, reason: "vazio após removePatterns" });
      continue;
    }

    const leakage = auditLeakage(sanitizedHeading + "\n" + cleanedContent, glossary.auditCheck);
    if (leakage.length > 0) {
      discarded.push({ chunk, reason: `leakage residual: ${leakage.join(", ")}` });
      continue;
    }

    const sanitizationLog = [
      ...Array.from(headingLog.entries()).map(([from, { to, count }]) => ({ from, to, count })),
      ...Array.from(contentLog.entries()).map(([from, { to, count }]) => ({ from, to, count })),
    ];

    for (const { from, count } of sanitizationLog) {
      totalReplacements.set(from, (totalReplacements.get(from) ?? 0) + count);
    }

    clean.push({
      ...chunk,
      headingPath: sanitizedHeading.split(" / "),
      content: cleanedContent,
      charCount: cleanedContent.length,
      sanitized: true,
      sanitizationLog,
    });
  }

  const outputPath = join(OUTPUT_DIR, OUTPUT_FILE);
  await writeFile(outputPath, JSON.stringify(clean, null, 2), "utf8");

  console.log(`\nSubstituições aplicadas:`);
  if (totalReplacements.size === 0) {
    console.log("  (nenhuma — corpus já estava sem termos proprietários)");
  } else {
    for (const [from, count] of [...totalReplacements.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${from}: ${count}x`);
    }
  }

  console.log(`\nDescartados: ${discarded.length}`);
  for (const { chunk, reason } of discarded.slice(0, 10)) {
    console.log(`  [${chunk.id}] ${chunk.headingPath.join(" / ")} — ${reason}`);
  }
  if (discarded.length > 10) {
    console.log(`  ... e mais ${discarded.length - 10}`);
  }

  console.log(`\n${clean.length} chunks sanitizados → ${outputPath}`);
}

main().catch((err) => {
  console.error("Sanitize falhou:", err);
  process.exit(1);
});
