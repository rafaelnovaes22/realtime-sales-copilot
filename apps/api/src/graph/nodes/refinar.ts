/**
 * Node `refinar` — LLM condicional (refiner, Gemini). Só roda quando o guardian
 * bloqueia E tentativasRefino < MAX_REFINO. Reescreve corrigindo o motivo do bloqueio
 * (ex: marca proibida, >2 linhas, >280 chars) e volta ao guardian.
 */

import { getLLM } from "../../../../../src/llm/index.js";
import { MAX_CHARS, MAX_LINES } from "../../guardian.js";
import type { GraphStateType, GraphUpdate } from "../state.js";

const SYSTEM = `Você reescreve uma sugestão de fala para um closer que foi REJEITADA por um filtro.
Corrija o problema apontado mantendo o sentido e o tom consultivo.
Regras: 1-2 linhas, no máximo ${MAX_CHARS} caracteres; nunca cite nome de empresa, produto,
escola, mentor, concorrente ou marca; sem promessa de resultado. Responda só com a fala, sem aspas.`;

export async function refinar(state: GraphStateType): Promise<GraphUpdate> {
  const motivo = state.guardianResult && !state.guardianResult.ok ? state.guardianResult.reason : "formato inválido";
  try {
    const llm = await getLLM("refiner");
    const resp = await llm.complete({
      system: SYSTEM,
      user: `Sugestão rejeitada (motivo: ${motivo}):\n"${state.sugestaoEscolhida ?? ""}"\n\nMáx ${MAX_LINES} linhas. Reescreva corrigindo o motivo.`,
      maxTokens: 150,
      tenantId: state.tenantId,
      traceName: "live-suggestion-refiner",
    });

    return {
      sugestaoEscolhida: resp.text,
      tentativasRefino: state.tentativasRefino + 1,
      custoBrlAcumulado: resp.costBrl,
      llmCalls: [
        {
          role: "refiner",
          model: resp.rawModelId,
          latencyMs: resp.latencyMs,
          inputTokens: resp.inputTokens,
          outputTokens: resp.outputTokens,
          costBrl: resp.costBrl,
        },
      ],
    };
  } catch (err) {
    console.error("[graph] refinar falhou:", err);
    // Sem refino possível: incrementa a tentativa p/ não loopar; guardian decide o END.
    return { tentativasRefino: state.tentativasRefino + 1 };
  }
}
