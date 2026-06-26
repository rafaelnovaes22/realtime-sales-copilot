/**
 * Node `recuperarExemplos` — few-shot adaptativo (C4-safe). Roda em paralelo com
 * retrieve. Busca sugestões passadas VENCEDORAS (aceitas sem edição ou com venda
 * avançada/fechada) para o gatilho, e as injeta como exemplos no gerador.
 *
 * É in-context: não altera prompt canônico nem modelo (C4 ok). Cold-start: sem
 * dados (ou sem Postgres), retorna vazio → grafo opera como hoje.
 *
 * MVP: busca por gatilho/tipo via SQL. Similaridade semântica (pgvector) é
 * evolução futura.
 */

import { fetchWinningExamples } from "../../learning/store.js";
import type { GraphStateType, GraphUpdate } from "../state.js";

const MAX_EXEMPLOS = 3;

export async function recuperarExemplos(state: GraphStateType): Promise<GraphUpdate> {
  const gatilho = state.gatilhos[0];
  if (!gatilho) return { exemplosFewShot: [] };

  try {
    const exemplos = await fetchWinningExamples({
      gatilho,
      tipo: state.classificacaoObjecao?.tipo ?? null,
      tenantId: state.tenantId,
      limit: MAX_EXEMPLOS,
    });
    return { exemplosFewShot: exemplos };
  } catch (err) {
    console.error("[graph] recuperarExemplos falhou (seguindo sem few-shot):", err);
    return { exemplosFewShot: [] };
  }
}
