/**
 * Retrieval: dado um gatilho detectado e o buffer recente da conversa,
 * pontua e retorna os top N chunks do corpus.clean.json.
 *
 * Sem pgvector no MVP — keyword match + tag match é suficiente para 500 chunks.
 * Carrega o corpus em memória uma vez (~600KB).
 */

import { readFileSync } from "node:fs";
import type { Gatilho } from "./gatilhos.js";

const CORPUS_PATH = "corpus/clean/corpus.clean.json";

type Estado = "abertura" | "diagnostico" | "apresentacao" | "objecao" | "fechamento" | "pos_call" | "meta";
type Tipo =
  | "pergunta_diagnostica"
  | "resposta_objecao"
  | "proximo_passo"
  | "exemplo_dialogo"
  | "script_fala"
  | "exercicio"
  | "erro_comum"
  | "explicacao_conceito"
  | "estrutura_processo";

export type Chunk = {
  id: string;
  source: string;
  headingPath: string[];
  level: number;
  content: string;
  position: number;
  charCount: number;
  tags?: { estado: Estado[]; gatilho: string[]; tipo: Tipo[] };
};

let CORPUS_CACHE: Chunk[] | null = null;

function loadCorpus(): Chunk[] {
  if (!CORPUS_CACHE) {
    CORPUS_CACHE = JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as Chunk[];
  }
  return CORPUS_CACHE;
}

const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "do", "da", "dos", "das",
  "em", "no", "na", "nos", "nas", "e", "ou", "que", "se", "para", "por",
  "com", "sem", "como", "isso", "esse", "essa", "este", "esta", "ele",
  "ela", "eu", "voce", "você", "vc", "ja", "já", "mais", "mas", "muito",
  "também", "tambem", "tem", "ter", "ser", "é", "está", "estou", "tô",
  "foi", "vai", "ir", "fazer", "feito", "feita",
]);

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

export type RetrievalOptions = {
  gatilhos: Gatilho[];
  estado?: Estado;
  buffer: string;
  topN?: number;
};

export type ScoredChunk = { chunk: Chunk; score: number; reasons: string[] };

export function retrieve({ gatilhos, estado, buffer, topN = 5 }: RetrievalOptions): ScoredChunk[] {
  const corpus = loadCorpus();
  const bufferKeywords = extractKeywords(buffer);

  const scored: ScoredChunk[] = [];

  for (const chunk of corpus) {
    if (!chunk.tags) continue;
    if (chunk.tags.estado.includes("meta")) continue;

    let score = 0;
    const reasons: string[] = [];

    for (const g of gatilhos) {
      if (chunk.tags.gatilho.includes(g)) {
        score += 10;
        reasons.push(`gatilho:${g}`);
      }
    }

    if (chunk.tags.tipo.includes("resposta_objecao")) {
      score += gatilhos.length > 0 ? 5 : 0;
      if (gatilhos.length > 0) reasons.push("tipo:resposta_objecao");
    }
    if (chunk.tags.tipo.includes("pergunta_diagnostica")) {
      score += estado === "diagnostico" ? 4 : 2;
      reasons.push("tipo:pergunta_diagnostica");
    }
    if (chunk.tags.tipo.includes("script_fala")) {
      score += 3;
      reasons.push("tipo:script_fala");
    }
    if (chunk.tags.tipo.includes("exemplo_dialogo")) {
      score += 2;
      reasons.push("tipo:exemplo_dialogo");
    }

    if (estado && chunk.tags.estado.includes(estado)) {
      score += 3;
      reasons.push(`estado:${estado}`);
    }

    if (bufferKeywords.size > 0) {
      const chunkKeywords = extractKeywords(chunk.content);
      let keywordHits = 0;
      for (const kw of bufferKeywords) {
        if (chunkKeywords.has(kw)) keywordHits++;
      }
      if (keywordHits > 0) {
        score += Math.min(keywordHits, 5);
        reasons.push(`keywords:${keywordHits}`);
      }
    }

    if (score > 0) {
      scored.push({ chunk, score, reasons });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
