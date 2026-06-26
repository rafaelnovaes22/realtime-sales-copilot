/**
 * Node `inferEstado` — determinístico, roda em paralelo com classifyObjecao.
 * Deriva o estado da conversa. Sem LLM no caminho default (protege o SLA):
 * usa o estado do request se informado; senão, presença de gatilho ⇒ "objecao".
 */

import type { GraphStateType, GraphUpdate } from "../state.js";

export async function inferEstado(state: GraphStateType): Promise<GraphUpdate> {
  const estado = state.estadoInput ?? (state.gatilhos.length > 0 ? "objecao" : "diagnostico");
  return { estadoConversa: estado };
}
