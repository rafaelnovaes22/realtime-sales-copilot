/**
 * Pipeline ponta-a-ponta: buffer → detector → retriever → generator → guardian.
 *
 * Usado pelo backend WebSocket no MVP e pelo CLI de teste.
 */

import { detectGatilhos, type Gatilho } from "./gatilhos.js";
import { retrieve, type ScoredChunk } from "./retriever.js";
import { generate, type GenerateResult } from "./generator.js";
import { guard, type GuardianResult } from "./guardian.js";

export type PipelineInput = {
  buffer: string;
  estado?: "abertura" | "diagnostico" | "apresentacao" | "objecao" | "fechamento";
};

export type PipelineResult = {
  status: "no_gatilho" | "no_chunks" | "blocked_by_guardian" | "ok";
  gatilhos: Gatilho[];
  chunks: ScoredChunk[];
  generation?: GenerateResult;
  guardian?: GuardianResult;
  totalLatencyMs: number;
  reason?: string;
};

export async function run(input: PipelineInput): Promise<PipelineResult> {
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
    topN: 5,
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
