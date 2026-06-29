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

export type LLMRole =
  | "generator"
  | "tagger"
  | "guardian"
  | "classifier"
  | "ranker"
  | "refiner";

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

type ProviderSpec = { provider: string; modelId: string };

/**
 * Mapeamento role → (primary + fallback). Gemini 2.5 Flash via Vertex é o
 * provider primário (D011); Anthropic é o fallback de portabilidade (C7).
 * Em projetos multi-tenant, o tenant pode override via
 * `TenantContext.llm_role_overrides` (futuro PR-fase2-02).
 */
const ROLE_CONFIG: Record<LLMRole, { primary: ProviderSpec; fallback?: ProviderSpec }> = {
  generator: {
    primary: { provider: "gemini-vertex", modelId: "gemini-2.5-flash" },
    fallback: { provider: "anthropic", modelId: "claude-sonnet-4-6" },
  },
  classifier: {
    primary: { provider: "gemini-vertex", modelId: "gemini-2.5-flash" },
    fallback: { provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
  },
  ranker: {
    primary: { provider: "gemini-vertex", modelId: "gemini-2.5-flash" },
    fallback: { provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
  },
  refiner: {
    primary: { provider: "gemini-vertex", modelId: "gemini-2.5-flash" },
    fallback: { provider: "anthropic", modelId: "claude-sonnet-4-6" },
  },
  tagger: {
    primary: { provider: "gemini-vertex", modelId: "gemini-2.5-flash" },
    fallback: { provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
  },
  guardian: {
    primary: { provider: "gemini-vertex", modelId: "gemini-2.5-flash" },
    fallback: { provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
  },
};

const providerCache = new Map<string, LLMProvider>();

async function buildProvider(spec: ProviderSpec): Promise<LLMProvider> {
  const cacheKey = `${spec.provider}:${spec.modelId}`;
  const cached = providerCache.get(cacheKey);
  if (cached) return cached;

  let instance: LLMProvider;
  if (spec.provider === "gemini-vertex") {
    const { GeminiVertexProvider } = await import("./adapters/gemini.js");
    instance = new GeminiVertexProvider(spec.modelId);
  } else if (spec.provider === "anthropic") {
    const { AnthropicProvider } = await import("./adapters/anthropic.js");
    instance = new AnthropicProvider(spec.modelId);
  } else {
    throw new Error(`LLM provider not implemented: ${spec.provider}`);
  }

  providerCache.set(cacheKey, instance);
  return instance;
}

export async function getLLM(role: LLMRole): Promise<LLMProvider> {
  const { primary, fallback } = ROLE_CONFIG[role];
  const cacheKey = fallback
    ? `${primary.provider}:${primary.modelId}->${fallback.provider}:${fallback.modelId}`
    : `${primary.provider}:${primary.modelId}`;

  const cached = providerCache.get(cacheKey);
  if (cached) return cached;

  const primaryProvider = await buildProvider(primary);
  if (!fallback) return primaryProvider;

  const secondaryProvider = await buildProvider(fallback);
  const { FallbackProvider } = await import("./adapters/fallback.js");
  const wrapped = new FallbackProvider(primaryProvider, secondaryProvider);
  providerCache.set(cacheKey, wrapped);
  return wrapped;
}
