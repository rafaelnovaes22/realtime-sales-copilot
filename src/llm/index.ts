/**
 * LLM abstraction layer (C7 — Portability over lock-in).
 *
 * Esta camada existe para isolar os SDKs específicos de provedor (Anthropic,
 * OpenAI, etc.) do código de domínio. Trocar de provedor (ou rodar fallback
 * cross-provider) deve exigir apenas adicionar um adapter em `adapters/` e
 * ajustar o factory abaixo — nunca tocar em `apps/api/src/generator.ts`,
 * `scripts/tag-corpus.ts`, ou qualquer outro consumidor.
 *
 * Regra ESLint (a aplicar): `@anthropic-ai/sdk` só pode ser importado dentro
 * de `src/llm/adapters/`. Validado pelo code-reviewer-claude antes de merge.
 */

export type LLMRole = "generator" | "tagger" | "guardian";

export type LLMRequest = {
  /** Mensagem de sistema. Pode ser cacheada via `cacheSystem: true`. */
  system: string;
  /** Mensagem de usuário (turn único; multi-turn não é necessário no MVP). */
  user: string;
  /** Limite máximo de tokens de saída. */
  maxTokens: number;
  /** Se true, marca o system prompt como ephemeral cache (Anthropic). */
  cacheSystem?: boolean;
  /**
   * Tenant ID propagado para o trace. Obrigatório para C8 (anti-customização)
   * e C6 (trace tagging por tenant).
   */
  tenantId: string;
  /** Nome legível do trace (ex: "live-suggestion-generator"). C6. */
  traceName: string;
};

export type LLMResponse = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /** Custo estimado em BRL com base na tabela de preços do adapter. */
  costBrl: number;
  /** Model ID real usado (ex: "claude-sonnet-4-6"). */
  rawModelId: string;
};

export interface LLMProvider {
  complete(req: LLMRequest): Promise<LLMResponse>;
  readonly providerName: string;
  readonly modelId: string;
}

/**
 * Mapeamento role → (provider + model). Em projetos multi-tenant, o tenant
 * pode override via `TenantContext.llm_role_overrides` (futuro PR-fase2-02).
 * Por enquanto, hardcoded para Acme-internal (decisão D007).
 */
const DEFAULT_MODEL_BY_ROLE: Record<LLMRole, { provider: string; modelId: string }> = {
  generator: { provider: "anthropic", modelId: "claude-sonnet-4-6" },
  tagger: { provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
  guardian: { provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
};

const providerCache = new Map<string, LLMProvider>();

export async function getLLM(role: LLMRole): Promise<LLMProvider> {
  const { provider, modelId } = DEFAULT_MODEL_BY_ROLE[role];
  const cacheKey = `${provider}:${modelId}`;

  let instance = providerCache.get(cacheKey);
  if (instance) return instance;

  if (provider === "anthropic") {
    const { AnthropicProvider } = await import("./adapters/anthropic.js");
    instance = new AnthropicProvider(modelId);
  } else {
    throw new Error(`LLM provider not implemented: ${provider}`);
  }

  providerCache.set(cacheKey, instance);
  return instance;
}
