/**
 * Node `retrieve` — determinístico (scoring lexical). Reusa apps/api/src/retriever.ts.
 * Junção dos branches classify ∥ inferEstado. Early-exit `no_chunks`.
 */

import { retrieve as retrieveCorpus } from "../../retriever.js";
import type { GraphStateType, GraphUpdate } from "../state.js";

export async function retrieve(state: GraphStateType): Promise<GraphUpdate> {
  const chunks = retrieveCorpus({
    gatilhos: state.gatilhos,
    estado: state.estadoConversa,
    buffer: state.buffer,
    topN: 3,
  });

  if (chunks.length === 0) {
    return { chunks: [], status: "no_chunks" };
  }
  return { chunks };
}
