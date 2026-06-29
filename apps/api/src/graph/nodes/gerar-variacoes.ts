/**
 * Node `gerarVariacoes` — LLM fan-out (generator, Gemini). Gera N=2 variações em
 * paralelo, com ângulos DISTINTOS (resposta-reframe vs pergunta diagnóstica), o
 * hint do tipo de objeção e os exemplos few-shot (Onda 5). Promise.all protege o SLA.
 *
 * Toda chamada passa por getLLM (observe()/C6 + fallback/C7).
 */

import { getLLM } from "../../../../../src/llm/index.js";
import { SYSTEM_PROMPT, buildContextFromChunks } from "../../generator.js";
import type { GraphStateType, GraphUpdate, LlmCallMeta, Variacao } from "../state.js";
import { PROMPT_HINTS } from "./objecao-tipo.js";

const ANGULOS = [
  "Escreva a FALA DE RESPOSTA: um reframing curto que conecta a hesitação ao custo de não agir.",
  "Escreva uma PERGUNTA DIAGNÓSTICA curta que revela o problema real por trás da objeção.",
];

function buildUser(state: GraphStateType, angulo: string): string {
  const parts: string[] = [];
  if (state.gatilhos.length > 0) {
    parts.push(`Gatilho(s) detectado(s): ${state.gatilhos.join(", ")}`);
  }
  if (state.classificacaoObjecao) {
    const c = state.classificacaoObjecao;
    parts.push(`Tipo de objeção: ${c.tipo} (${c.realVsCortina}). ${PROMPT_HINTS[c.tipo]}`);
  }
  parts.push(`Últimos turnos da conversa (transcrição):\n${state.buffer}`);
  if (state.chunks.length > 0) {
    parts.push(`Material de treinamento relevante:\n\n${buildContextFromChunks(state.chunks)}`);
  }
  if (state.exemplosFewShot.length > 0) {
    const ex = state.exemplosFewShot.map((e, i) => `${i + 1}. ${e.texto}`).join("\n");
    parts.push(`Falas que já funcionaram bem nesta situação (use como referência de tom, não copie):\n${ex}`);
  }
  parts.push(`${angulo} 1-2 linhas, no tom do closer. Sem prefácio, sem aspas.`);
  return parts.join("\n\n---\n\n");
}

export async function gerarVariacoes(state: GraphStateType): Promise<GraphUpdate> {
  const llm = await getLLM("generator");

  const results = await Promise.all(
    ANGULOS.map(async (angulo, i): Promise<{ variacao: Variacao; meta: LlmCallMeta }> => {
      const resp = await llm.complete({
        system: SYSTEM_PROMPT,
        user: buildUser(state, angulo),
        maxTokens: 150,
        cacheSystem: true,
        tenantId: state.tenantId,
        traceName: `live-suggestion-generator.v${i + 1}`,
      });
      return {
        variacao: { id: `v${i + 1}`, texto: resp.text },
        meta: {
          role: "generator",
          model: resp.rawModelId,
          latencyMs: resp.latencyMs,
          inputTokens: resp.inputTokens,
          outputTokens: resp.outputTokens,
          costBrl: resp.costBrl,
        },
      };
    }),
  );

  return {
    variacoes: results.map((r) => r.variacao).filter((v) => v.texto.length > 0),
    custoBrlAcumulado: results.reduce((sum, r) => sum + r.meta.costBrl, 0),
    llmCalls: results.map((r) => r.meta),
  };
}
