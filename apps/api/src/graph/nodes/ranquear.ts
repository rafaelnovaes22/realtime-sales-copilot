/**
 * Node `ranquear` — determinístico por default (economiza 1 call no caminho quente).
 * Escolhe a melhor variação: prefere a primeira que respeita os limites do guardian
 * (não-vazia, ≤ MAX_CHARS, ≤ MAX_LINES); senão cai na primeira variação (guardian
 * decide o refino). O ranker via LLM fica atrás de flag (futuro).
 */

import { MAX_CHARS, MAX_LINES } from "../../guardian.js";
import type { GraphStateType, GraphUpdate } from "../state.js";

function dentroDosLimites(texto: string): boolean {
  const t = texto.trim();
  if (t.length === 0 || t.length > MAX_CHARS) return false;
  const linhas = t.split("\n").filter((l) => l.trim().length > 0);
  return linhas.length <= MAX_LINES;
}

export async function ranquear(state: GraphStateType): Promise<GraphUpdate> {
  const valida = state.variacoes.find((v) => dentroDosLimites(v.texto));
  const escolhida = valida ?? state.variacoes[0] ?? null;
  return { sugestaoEscolhida: escolhida?.texto ?? null };
}
