/**
 * Gerador de sugestão: usa a abstração `src/llm/` (C7) com role=generator.
 * Output: 1-2 linhas curtas que o closer pode ler de relance.
 *
 * Este arquivo NÃO importa `@anthropic-ai/sdk` direto — toda interação com
 * provider de LLM passa por `getLLM("generator")`. Trocar Sonnet por Opus
 * ou rodar OpenAI fallback exige apenas mudar a config do role.
 */

import { getLLM } from "../../../src/llm/index.js";
import type { Gatilho } from "./gatilhos.js";
import type { ScoredChunk } from "./retriever.js";

const SYSTEM_PROMPT = `Você é um co-pilot que sugere falas a um vendedor consultivo (closer) durante ligações ao vivo.

Sua sugestão aparece como card na tela do closer, que está em conversa com o cliente. Ele precisa ler de relance e usar imediatamente.

Regras inegociáveis:
- 1 ou 2 linhas curtas. Nunca mais.
- Linguagem natural de conversa, não de manual.
- Não cite marca, empresa, produto, programa, metodologia proprietária ou placeholders entre colchetes (ex: [Seguradora]).
- Não diga "diga ao cliente". Escreva a fala pronta, no tom do closer.
- Se a sugestão for uma pergunta, faça uma pergunta que o closer pode falar agora.
- Se for resposta a objeção, dê o reframing curto, sem palestra.

Use o material de treinamento abaixo como referência de método e tom, mas reescreva — não copie blocos longos.`;

export type GenerateOptions = {
  gatilhos: Gatilho[];
  bufferTranscript: string;
  chunks: ScoredChunk[];
  /** Tenant ID propagado para o trace. C8. Default: "acme-internal". */
  tenantId?: string;
};

export type GenerateResult = {
  text: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costBrl: number;
  modelId: string;
};

function buildContextFromChunks(chunks: ScoredChunk[]): string {
  return chunks
    .map((c, i) => {
      const path = c.chunk.headingPath.join(" / ");
      return `[Trecho ${i + 1} — ${path}]\n${c.chunk.content}`;
    })
    .join("\n\n");
}

export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const { gatilhos, bufferTranscript, chunks } = opts;

  const userParts: string[] = [];

  if (gatilhos.length > 0) {
    userParts.push(`Gatilho(s) detectado(s): ${gatilhos.join(", ")}`);
  }
  userParts.push(`Últimos turnos da conversa (transcrição):\n${bufferTranscript}`);

  if (chunks.length > 0) {
    userParts.push(`Material de treinamento relevante:\n\n${buildContextFromChunks(chunks)}`);
  }

  userParts.push(
    "Escreva a fala que o closer deve usar agora. 1-2 linhas, direta, no tom do closer. Sem prefácio, sem aspas.",
  );

  const llm = await getLLM("generator");
  const resp = await llm.complete({
    system: SYSTEM_PROMPT,
    user: userParts.join("\n\n---\n\n"),
    maxTokens: 150,
    cacheSystem: true,
    tenantId: opts.tenantId ?? "acme-internal",
    traceName: "live-suggestion-generator",
  });

  return {
    text: resp.text,
    latencyMs: resp.latencyMs,
    inputTokens: resp.inputTokens,
    outputTokens: resp.outputTokens,
    costBrl: resp.costBrl,
    modelId: resp.rawModelId,
  };
}
