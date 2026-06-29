/**
 * Node `detect` — entry. Detecção determinística de gatilhos (regex).
 * Reusa apps/api/src/gatilhos.ts sem alteração (prova C7).
 */

import { detectGatilhos } from "../../gatilhos.js";
import type { GraphStateType, GraphUpdate } from "../state.js";

export async function detect(state: GraphStateType): Promise<GraphUpdate> {
  const gatilhos = detectGatilhos(state.buffer);
  if (gatilhos.length === 0) {
    return { gatilhos: [], status: "no_gatilho" };
  }
  return { gatilhos };
}
