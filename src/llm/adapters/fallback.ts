/**
 * FallbackProvider — portabilidade cross-provider (C7).
 *
 * Tenta o provider primário (Gemini/Vertex); se ele lançar (erro de rede,
 * quota, auth), cai para o secundário (Anthropic). Cada provider mantém o
 * próprio `observe()`, então um fallback gera 2 traces (primário falho +
 * secundário ok) — desejável para auditoria (C6).
 */

import type { LLMProvider, LLMRequest, LLMResponse } from "../index.js";

export class FallbackProvider implements LLMProvider {
  readonly providerName: string;
  readonly modelId: string;

  constructor(
    private readonly primary: LLMProvider,
    private readonly secondary: LLMProvider,
  ) {
    this.providerName = `${primary.providerName}->${secondary.providerName}`;
    this.modelId = primary.modelId;
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    try {
      return await this.primary.complete(req);
    } catch (err) {
      console.error(
        `[llm] provider primário '${this.primary.providerName}' falhou, usando fallback '${this.secondary.providerName}':`,
        err instanceof Error ? err.message : String(err),
      );
      return this.secondary.complete({
        ...req,
        traceName: `${req.traceName}.fallback`,
      });
    }
  }
}
