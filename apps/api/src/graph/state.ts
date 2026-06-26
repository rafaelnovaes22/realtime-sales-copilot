/**
 * Estado do grafo de objeções (LangGraph.js).
 *
 * Reducers de soma/concat em custoBrlAcumulado/llmCalls suportam o merge de
 * branches paralelos (classify ∥ inferEstado) e do fan-out de variações.
 * Campos de "última escrita" (default) para os demais.
 */

import { Annotation } from "@langchain/langgraph";

import type { Gatilho } from "../gatilhos.js";
import type { ScoredChunk } from "../retriever.js";
import type { GuardianResult } from "../guardian.js";

export type EstadoConversa =
  | "abertura"
  | "diagnostico"
  | "apresentacao"
  | "objecao"
  | "fechamento";

export type PipelineStatus = "no_gatilho" | "no_chunks" | "blocked_by_guardian" | "ok";

/** Tipo da objeção (padrão de objeção, independente de domínio). */
export type ObjTipo =
  | "preco"
  | "autoridade"
  | "ceticismo_tech"
  | "timing"
  | "status_quo"
  | "brush_off";

export type ObjClass = {
  tipo: ObjTipo;
  realVsCortina: "real" | "cortina_de_fumaca";
  confianca: number; // 0..1
  gatilhoPrincipal: Gatilho | null;
};

/** Telemetria por chamada LLM (agregada no estado para a fachada). */
export type LlmCallMeta = {
  role: string;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costBrl: number;
};

export type Variacao = { id: string; texto: string };

/** Exemplo few-shot recuperado de sugestões passadas vencedoras (Onda 5). */
export type ExemploFewShot = { texto: string; gatilho: string; tipo: string };

export const MAX_REFINO = 1;

export const GraphState = Annotation.Root({
  // ── Entrada ────────────────────────────────────────────────────────────
  buffer: Annotation<string>,
  estadoInput: Annotation<EstadoConversa | undefined>,
  tenantId: Annotation<string>,
  closerId: Annotation<string | undefined>,

  // ── Derivados ──────────────────────────────────────────────────────────
  gatilhos: Annotation<Gatilho[]>({ reducer: (_, b) => b, default: () => [] }),
  estadoConversa: Annotation<EstadoConversa>({ reducer: (_, b) => b, default: () => "objecao" }),
  classificacaoObjecao: Annotation<ObjClass | null>({ reducer: (_, b) => b, default: () => null }),
  chunks: Annotation<ScoredChunk[]>({ reducer: (_, b) => b, default: () => [] }),
  exemplosFewShot: Annotation<ExemploFewShot[]>({ reducer: (_, b) => b, default: () => [] }),
  variacoes: Annotation<Variacao[]>({ reducer: (_, b) => b, default: () => [] }),
  sugestaoEscolhida: Annotation<string | null>({ reducer: (_, b) => b, default: () => null }),
  guardianResult: Annotation<GuardianResult | null>({ reducer: (_, b) => b, default: () => null }),
  tentativasRefino: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),

  // ── Saída / telemetria ────────────────────────────────────────────────
  status: Annotation<PipelineStatus>({ reducer: (_, b) => b, default: () => "ok" }),
  custoBrlAcumulado: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
  llmCalls: Annotation<LlmCallMeta[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});

export type GraphStateType = typeof GraphState.State;
export type GraphUpdate = Partial<typeof GraphState.Update>;
