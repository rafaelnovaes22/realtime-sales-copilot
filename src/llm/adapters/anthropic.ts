/**
 * Anthropic adapter — ÚNICO local autorizado a importar `@anthropic-ai/sdk`.
 *
 * Lint regra (a aplicar): `@anthropic-ai/sdk` proibido fora desta pasta.
 * Validado pelo code-reviewer-claude no PR.
 */

import Anthropic from "@anthropic-ai/sdk";

import { observe } from "../../observability/trace.js";
import type { LLMProvider, LLMRequest, LLMResponse } from "../index.js";

const USD_TO_BRL = 5.5;

/** Tabela de preços em USD por 1M tokens. Atualizar quando Anthropic mudar. */
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
};

export class AnthropicProvider implements LLMProvider {
  readonly providerName = "anthropic";
  readonly modelId: string;

  private readonly client: Anthropic;

  constructor(modelId: string) {
    this.modelId = modelId;
    this.client = new Anthropic();
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    return observe(
      {
        name: req.traceName,
        tenantId: req.tenantId,
        model: this.modelId,
        metadata: { provider: this.providerName, cache_system: req.cacheSystem === true },
      },
      async (trace) => {
        const systemBlocks = req.cacheSystem
          ? ([
              {
                type: "text",
                text: req.system,
                cache_control: { type: "ephemeral" },
              },
            ] as unknown as Anthropic.MessageCreateParams["system"])
          : req.system;

        trace.input({
          system: req.system,
          user: req.user,
          max_tokens: req.maxTokens,
        });

        const startedAt = Date.now();

        const resp = await this.client.messages.create({
          model: this.modelId,
          max_tokens: req.maxTokens,
          system: systemBlocks,
          messages: [{ role: "user", content: req.user }],
          metadata: { user_id: req.tenantId },
        });

        const latencyMs = Date.now() - startedAt;

        const text = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();

        const costBrl = this.estimateCostBrl(resp.usage.input_tokens, resp.usage.output_tokens);

        trace.output({ text, stop_reason: resp.stop_reason });
        trace.cost({
          brl: costBrl,
          inputTokens: resp.usage.input_tokens,
          outputTokens: resp.usage.output_tokens,
        });

        return {
          text,
          inputTokens: resp.usage.input_tokens,
          outputTokens: resp.usage.output_tokens,
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
