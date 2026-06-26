/**
 * Node `guardian` — determinístico (regex brand + limites). Reusa apps/api/src/guardian.ts.
 * Define o status (ok | blocked_by_guardian); o roteamento condicional decide o refino.
 */

import { guard } from "../../guardian.js";
import type { GraphStateType, GraphUpdate } from "../state.js";

export async function guardian(state: GraphStateType): Promise<GraphUpdate> {
  const result = guard(state.sugestaoEscolhida ?? "");
  return {
    guardianResult: result,
    status: result.ok ? "ok" : "blocked_by_guardian",
  };
}
