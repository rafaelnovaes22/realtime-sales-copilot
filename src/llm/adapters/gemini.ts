/**
 * Gemini (Vertex AI) adapter — ÚNICO local autorizado a importar `@google/genai`.
 *
 * Provider primário do projeto (D011). Espelha a estrutura do AnthropicProvider:
 * toda chamada passa por `observe()` (C6) e estima custo em BRL.
 *
 * Lint/Gate G1 (pre-merge-check): `@google/genai` proibido fora desta pasta.
 *
 * Auth via ADC (Application Default Credentials):
 *   - dev local: `gcloud auth application-default login`
 *   - Railway (não-GCP): GOOGLE_APPLICATION_CREDENTIALS → service-account key JSON
 *   - GCP (Cloud Run, futuro): Workload Identity (sem chave)
 */

import { GoogleGenAI } from "@google/genai";

import { observe } from "../../observability/trace.js";
import type { LLMProvider, LLMRequest, LLMResponse } from "../index.js";

const USD_TO_BRL = 5.7;

/** Tabela de preços em USD por 1M tokens. Atualizar quando o Vertex mudar. */
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  // Gemini 2.5 Flash (prompts ≤ 200k tokens). Fonte: pricing Vertex AI.
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
};

function resolveVertexConfig() {
  const project = process.env.GCP_PROJECT;
  const location = process.env.GCP_LOCATION ?? "us-central1";
  if (!project) {
    throw new Error(
      "GCP_PROJECT ausente — Gemini/Vertex requer GCP_PROJECT (e ADC via gcloud ou GOOGLE_APPLICATION_CREDENTIALS).",
    );
  }
  return { project, location };
}

export class GeminiVertexProvider implements LLMProvider {
  readonly providerName = "gemini-vertex";
  readonly modelId: string;

  // Lazy: construção do client (e validação de GCP_PROJECT/ADC) só no primeiro
  // complete(). Garante que falha de config/auth ocorra DENTRO de complete()
  // e seja capturada pelo FallbackProvider (→ Anthropic), em vez de derrubar
  // getLLM() no construtor.
  private client: GoogleGenAI | null = null;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const { project, location } = resolveVertexConfig();
      this.client = new GoogleGenAI({ vertexai: true, project, location });
    }
    return this.client;
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    return observe(
      {
        name: req.traceName,
        tenantId: req.tenantId,
        model: this.modelId,
        // Gemini não tem ephemeral cache estilo Anthropic — cacheSystem é no-op
        // aqui (débito: explicit context caching se C3 apertar).
        metadata: { provider: this.providerName, cache_system: false },
      },
      async (trace) => {
        trace.input({
          system: req.system,
          user: req.user,
          max_tokens: req.maxTokens,
        });

        const startedAt = Date.now();

        const resp = await this.getClient().models.generateContent({
          model: this.modelId,
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          config: {
            systemInstruction: req.system,
            maxOutputTokens: req.maxTokens,
          },
        });

        const latencyMs = Date.now() - startedAt;

        const text = (resp.text ?? "").trim();
        const inputTokens = resp.usageMetadata?.promptTokenCount ?? 0;
        const outputTokens = resp.usageMetadata?.candidatesTokenCount ?? 0;
        const costBrl = this.estimateCostBrl(inputTokens, outputTokens);

        trace.output({ text, finish_reason: resp.candidates?.[0]?.finishReason });
        trace.cost({ brl: costBrl, inputTokens, outputTokens });

        return {
          text,
          inputTokens,
          outputTokens,
          latencyMs,
          costBrl,
          rawModelId: this.modelId,
        };
      },
    );
  }

  private estimateCostBrl(inputTokens: number, outputTokens: number): number {
    const pricing = PRICING_USD_PER_MTOK[this.modelId];
    if (!pricing) return 0;
    const inputUsd = (inputTokens / 1_000_000) * pricing.input;
    const outputUsd = (outputTokens / 1_000_000) * pricing.output;
    return Math.round((inputUsd + outputUsd) * USD_TO_BRL * 10000) / 10000;
  }
}
