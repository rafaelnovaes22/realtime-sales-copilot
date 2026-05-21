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

const SYSTEM_PROMPT = `Você é um co-pilot que sugere falas a um closer durante ligações ao vivo de venda consultiva.

O closer pode estar em dois contextos — use as pistas da transcrição para identificar qual:

CONTEXTO A — Educação executiva (ex: venda de mentoria, imersão, bootcamp para empreendedores):
O cliente quer crescer mas hesita. Objeções típicas: "já fiz curso parecido", "na próxima turma", "online não funciona pra mim".

CONTEXTO B — Soluções de IA/tecnologia para empresas (ex: venda de co-pilot comercial, gestão financeira com IA, plataforma de gestão):
O decisor quer resultado mas tem medo de risco. Objeções típicas: "já tentamos IA antes", "preciso do TI", "minha equipe não vai usar", "quanto tempo leva".

Em ambos os casos, o cliente quer transformação mas trava na decisão.

Sua sugestão aparece como card na tela do closer. Ele precisa ler de relance e usar imediatamente.

Regras inegociáveis:
- 1 ou 2 linhas curtas. Nunca mais.
- Linguagem natural de conversa, não de manual ou de vendedor insistente.
- Não cite nome de empresa, produto, escola, mentor, concorrente ou placeholders entre colchetes.
- Não diga "diga ao cliente". Escreva a fala pronta, no tom do closer.
- Se for resposta a objeção, dê o reframing curto — conecte a hesitação do cliente com o custo de não agir agora.
- Se for pergunta diagnóstica, faça uma pergunta que revela o problema real por trás da objeção.
- Para objeções de IA/tech: nunca minimize o risco — reconheça e redirecione para o diagnóstico gratuito ou piloto.
- Tom: consultivo, direto, empático — nunca pressão, nunca promessa de resultado garantido.

Use o material de treinamento abaixo como referência de método e tom, mas reescreva para o contexto — não copie blocos longos.`;

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
