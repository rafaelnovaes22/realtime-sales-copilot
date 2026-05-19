/**
 * Gerador de sugestão: Sonnet 4.6 com chunks relevantes em contexto.
 * Output: 1-2 linhas curtas que o closer pode ler de relance.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Gatilho } from "./gatilhos.js";
import type { ScoredChunk } from "./retriever.js";

const MODEL = "claude-sonnet-4-6";

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

const client = new Anthropic();

export type GenerateOptions = {
  gatilhos: Gatilho[];
  bufferTranscript: string;
  chunks: ScoredChunk[];
};

export type GenerateResult = {
  text: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
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

  const startedAt = Date.now();

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 150,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ] as unknown as Anthropic.MessageCreateParams["system"],
    messages: [{ role: "user", content: userParts.join("\n\n---\n\n") }],
  });

  const latencyMs = Date.now() - startedAt;

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return {
    text,
    latencyMs,
    inputTokens: resp.usage.input_tokens,
    outputTokens: resp.usage.output_tokens,
  };
}
