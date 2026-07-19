/**
 * Pipeline ponta-a-ponta: buffer → detector → retriever → generator → guardian.
 *
 * Duas implementações atrás da flag USE_GRAPH_PIPELINE:
 *   - runGraph  (default quando flag="true"): grafo de agentes LangGraph (objeções)
 *   - runLinear (legado / rollback): state machine linear de 1 chamada
 *
 * A fachada run() mantém a MESMA assinatura e o MESMO PipelineResult para não
 * quebrar o consumidor (apps/web-poc/server.ts).
 */

import { detectGatilhos, type Gatilho } from "./gatilhos.js";
import { retrieve, type ScoredChunk } from "./retriever.js";
import { generate, type GenerateResult } from "./generator.js";
import { guard, type GuardianResult } from "./guardian.js";
import { getGraph } from "./graph/graph.js";
import type { GraphStateType, ObjTipo } from "./graph/state.js";

export type PipelineInput = {
  buffer: string;
  estado?: "abertura" | "diagnostico" | "apresentacao" | "objecao" | "fechamento";
  tenantId?: string;
  closerId?: string;
};

export type PipelineResult = {
  status: "no_gatilho" | "no_chunks" | "blocked_by_guardian" | "ok";
  gatilhos: Gatilho[];
  chunks: ScoredChunk[];
  generation?: GenerateResult;
  guardian?: GuardianResult;
  totalLatencyMs: number;
  reason?: string;
  /** Tipo de objeção classificado (só no caminho do grafo). */
  tipo?: ObjTipo;
};

export async function run(input: PipelineInput): Promise<PipelineResult> {
  if (process.env.USE_GRAPH_PIPELINE === "true") {
    return runGraph(input);
  }
  return runLinear(input);
}

/** Adapta o estado final do grafo ao PipelineResult legado. */
function graphStateToResult(state: GraphStateType, totalLatencyMs: number): PipelineResult {
  const genCalls = state.llmCalls.filter((c) => c.role === "generator" || c.role === "refiner");
  const generation: GenerateResult | undefined =
    state.sugestaoEscolhida != null
      ? {
          text: state.sugestaoEscolhida,
          latencyMs: genCalls.reduce((s, c) => s + c.latencyMs, 0),
          inputTokens: genCalls.reduce((s, c) => s + c.inputTokens, 0),
          outputTokens: genCalls.reduce((s, c) => s + c.outputTokens, 0),
          costBrl: state.custoBrlAcumulado,
          modelId: genCalls[0]?.model ?? "unknown",
        }
      : undefined;

  return {
    status: state.status,
    gatilhos: state.gatilhos,
    chunks: state.chunks,
    generation,
    guardian: state.guardianResult ?? undefined,
    totalLatencyMs,
    reason:
      state.guardianResult && !state.guardianResult.ok ? state.guardianResult.reason : undefined,
    tipo: state.classificacaoObjecao?.tipo,
  };
}

export async function runGraph(input: PipelineInput): Promise<PipelineResult> {
  const t0 = Date.now();
  const state = (await getGraph().invoke(
    {
      buffer: input.buffer,
      estadoInput: input.estado,
      tenantId: input.tenantId ?? "novais-digital-internal",
      closerId: input.closerId,
    },
    { recursionLimit: 8 },
  )) as GraphStateType;
  return graphStateToResult(state, Date.now() - t0);
}

export async function runLinear(input: PipelineInput): Promise<PipelineResult> {
  const t0 = Date.now();

  const gatilhos = detectGatilhos(input.buffer);

  if (gatilhos.length === 0) {
    return {
      status: "no_gatilho",
      gatilhos: [],
      chunks: [],
      totalLatencyMs: Date.now() - t0,
    };
  }

  const inferredEstado = input.estado ?? (gatilhos.length > 0 ? "objecao" : "diagnostico");

  const chunks = retrieve({
    gatilhos,
    estado: inferredEstado,
    buffer: input.buffer,
    topN: 3,
  });

  if (chunks.length === 0) {
    return {
      status: "no_chunks",
      gatilhos,
      chunks: [],
      totalLatencyMs: Date.now() - t0,
    };
  }

  const generation = await generate({
    gatilhos,
    bufferTranscript: input.buffer,
    chunks,
  });

  const guardian = guard(generation.text);

  return {
    status: guardian.ok ? "ok" : "blocked_by_guardian",
    gatilhos,
    chunks,
    generation,
    guardian,
    totalLatencyMs: Date.now() - t0,
    reason: guardian.ok ? undefined : guardian.reason,
  };
}
