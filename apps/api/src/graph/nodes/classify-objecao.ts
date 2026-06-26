/**
 * Node `classifyObjecao` — LLM (classifier, Gemini). Classifica o tipo de objeção,
 * se é REAL ou cortina de fumaça, e a confiança. Roda em paralelo com inferEstado.
 *
 * Fallback determinístico (gatilhoToTipo) se o LLM falhar ou retornar JSON inválido.
 */

import { getLLM } from "../../../../../src/llm/index.js";
import type { GraphStateType, GraphUpdate, ObjClass, ObjTipo } from "../state.js";
import { gatilhoToTipo } from "./objecao-tipo.js";

const TIPOS: ObjTipo[] = ["preco", "autoridade", "ceticismo_tech", "timing", "status_quo", "brush_off"];

const SYSTEM = `Você classifica a objeção de um cliente numa ligação de venda consultiva.
Responda APENAS com JSON: {"tipo": "...", "real_vs_cortina": "real"|"cortina_de_fumaca", "confianca": 0.0-1.0}.
tipo ∈ [preco, autoridade, ceticismo_tech, timing, status_quo, brush_off].
"cortina_de_fumaca" = objeção genérica/educada que esconde a real (ex: "vou pensar" sem motivo concreto).`;

function fallback(state: GraphStateType): ObjClass {
  const principal = state.gatilhos[0] ?? null;
  return {
    tipo: principal ? gatilhoToTipo(principal) : "timing",
    realVsCortina: "real",
    confianca: 0.3,
    gatilhoPrincipal: principal,
  };
}

export async function classifyObjecao(state: GraphStateType): Promise<GraphUpdate> {
  const principal = state.gatilhos[0] ?? null;
  try {
    const llm = await getLLM("classifier");
    const resp = await llm.complete({
      system: SYSTEM,
      user: `Gatilhos detectados: ${state.gatilhos.join(", ")}\n\nTranscrição recente:\n${state.buffer}`,
      maxTokens: 120,
      tenantId: state.tenantId,
      traceName: "objecao-classifier",
    });

    const match = resp.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("sem JSON");
    const parsed = JSON.parse(match[0]) as {
      tipo?: string;
      real_vs_cortina?: string;
      confianca?: number;
    };
    const tipo = TIPOS.includes(parsed.tipo as ObjTipo)
      ? (parsed.tipo as ObjTipo)
      : principal
        ? gatilhoToTipo(principal)
        : "timing";

    const classificacao: ObjClass = {
      tipo,
      realVsCortina: parsed.real_vs_cortina === "cortina_de_fumaca" ? "cortina_de_fumaca" : "real",
      confianca: typeof parsed.confianca === "number" ? parsed.confianca : 0.5,
      gatilhoPrincipal: principal,
    };

    return {
      classificacaoObjecao: classificacao,
      custoBrlAcumulado: resp.costBrl,
      llmCalls: [
        {
          role: "classifier",
          model: resp.rawModelId,
          latencyMs: resp.latencyMs,
          inputTokens: resp.inputTokens,
          outputTokens: resp.outputTokens,
          costBrl: resp.costBrl,
        },
      ],
    };
  } catch (err) {
    console.error("[graph] classifyObjecao falhou, usando fallback determinístico:", err);
    return { classificacaoObjecao: fallback(state) };
  }
}
