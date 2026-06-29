/**
 * Monta e compila o grafo de objeções (LangGraph.js).
 *
 *   START → detect ─┬─(no_gatilho)→ END
 *                   └→ classifyObjecao ∥ inferEstado → retrieve ─┬─(no_chunks)→ END
 *                                                                └→ gerarVariacoes
 *      → ranquear → guardian ─┬─(ok)→ END
 *                             ├─(bloqueado, tentativas<MAX)→ refinar → guardian
 *                             └─(bloqueado, tentativas≥MAX)→ END
 *
 * Compilado UMA vez em module-scope (compile é caro). A fachada run() o reusa.
 */

import { StateGraph, START, END } from "@langchain/langgraph";

import { GraphState, MAX_REFINO, type GraphStateType } from "./state.js";
import { detect } from "./nodes/detect.js";
import { classifyObjecao } from "./nodes/classify-objecao.js";
import { inferEstado } from "./nodes/infer-estado.js";
import { recuperarExemplos } from "./nodes/recuperar-exemplos.js";
import { retrieve } from "./nodes/retrieve.js";
import { gerarVariacoes } from "./nodes/gerar-variacoes.js";
import { ranquear } from "./nodes/ranquear.js";
import { guardian } from "./nodes/guardian.js";
import { refinar } from "./nodes/refinar.js";

function routeAfterDetect(state: GraphStateType) {
  if (state.gatilhos.length === 0) return END;
  return ["classifyObjecao", "inferEstado", "recuperarExemplos"];
}

function routeAfterRetrieve(state: GraphStateType) {
  if (state.chunks.length === 0) return END;
  return "gerarVariacoes";
}

function routeAfterGuardian(state: GraphStateType) {
  if (state.status === "ok") return END;
  if (state.tentativasRefino < MAX_REFINO) return "refinar";
  return END;
}

function buildGraph() {
  return new StateGraph(GraphState)
    .addNode("detect", detect)
    .addNode("classifyObjecao", classifyObjecao)
    .addNode("inferEstado", inferEstado)
    .addNode("recuperarExemplos", recuperarExemplos)
    .addNode("retrieve", retrieve)
    .addNode("gerarVariacoes", gerarVariacoes)
    .addNode("ranquear", ranquear)
    .addNode("guardian", guardian)
    .addNode("refinar", refinar)
    .addEdge(START, "detect")
    .addConditionalEdges("detect", routeAfterDetect, [
      "classifyObjecao",
      "inferEstado",
      "recuperarExemplos",
      END,
    ])
    .addEdge("classifyObjecao", "retrieve")
    .addEdge("inferEstado", "retrieve")
    .addEdge("recuperarExemplos", "retrieve")
    .addConditionalEdges("retrieve", routeAfterRetrieve, ["gerarVariacoes", END])
    .addEdge("gerarVariacoes", "ranquear")
    .addEdge("ranquear", "guardian")
    .addConditionalEdges("guardian", routeAfterGuardian, ["refinar", END])
    .addEdge("refinar", "guardian")
    .compile();
}

let compiled: ReturnType<typeof buildGraph> | null = null;

export function getGraph() {
  if (!compiled) compiled = buildGraph();
  return compiled;
}
