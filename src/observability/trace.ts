/**
 * Observability — C6 (telemetry by default).
 *
 * Wrapper de Langfuse com ativação opcional via env vars. Quando
 * `LANGFUSE_PUBLIC_KEY` ausente, vira no-op silencioso (não bloqueia
 * desenvolvimento sem conta). Quando presente, instrumenta cada
 * `observe()` com generation/trace correlato.
 *
 * Princípio C6 exige instrumentação no código — esta camada satisfaz
 * isso. Ativação em produção é gate de promoção SHADOW (declarado em
 * docs/clients/acme-internal/diagnostic-live-suggestion-copilot.md).
 *
 * Uso típico (dentro de um LLM adapter):
 *
 *   const traced = await observe(
 *     { name: "live-suggestion-generator", tenantId, model: "claude-sonnet-4-6" },
 *     async (trace) => {
 *       trace.input({ system, user });
 *       const resp = await sdk.messages.create({...});
 *       trace.output({ text, usage: resp.usage });
 *       trace.cost({ brl: estimateCost(resp.usage) });
 *       return resp;
 *     },
 *   );
 */

import { Langfuse } from "langfuse";

type ObserveOptions = {
  name: string;
  tenantId: string;
  model?: string;
  /** Metadados livres a anexar ao trace. PII proibida (LGPD). */
  metadata?: Record<string, unknown>;
};

export type TraceHandle = {
  input(payload: unknown): void;
  output(payload: unknown): void;
  cost(payload: { brl: number; inputTokens?: number; outputTokens?: number }): void;
  error(err: unknown): void;
};

let cachedClient: Langfuse | null = null;
let initialized = false;

function client(): Langfuse | null {
  if (initialized) return cachedClient;
  initialized = true;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey || publicKey.startsWith("...")) {
    return null;
  }

  cachedClient = new Langfuse({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
    flushAt: 1,
  });

  return cachedClient;
}

export function isObservabilityActive(): boolean {
  return client() !== null;
}

/**
 * Executa `fn` com instrumentação Langfuse. Se Langfuse não estiver
 * configurado, executa fn com handle no-op — comportamento idêntico do
 * ponto de vista do caller.
 *
 * Nunca lança por falha de telemetria. Erros do `fn` propagam normalmente.
 */
export async function observe<T>(
  options: ObserveOptions,
  fn: (trace: TraceHandle) => Promise<T>,
): Promise<T> {
  const lf = client();

  if (!lf) {
    const noopHandle: TraceHandle = {
      input: () => {},
      output: () => {},
      cost: () => {},
      error: () => {},
    };
    return fn(noopHandle);
  }

  const trace = lf.trace({
    name: options.name,
    userId: options.tenantId,
    metadata: options.metadata,
  });

  const generation = trace.generation({
    name: options.name,
    model: options.model,
    startTime: new Date(),
  });

  const handle: TraceHandle = {
    input(payload) {
      try {
        generation.update({ input: payload });
      } catch {
        /* telemetria nunca derruba runtime */
      }
    },
    output(payload) {
      try {
        generation.update({ output: payload });
      } catch {
        /* idem */
      }
    },
    cost({ brl, inputTokens, outputTokens }) {
      try {
        const usd = brl / 5.5;
        generation.update({
          usage: {
            input: inputTokens,
            output: outputTokens,
            total: (inputTokens ?? 0) + (outputTokens ?? 0),
            unit: "TOKENS",
            inputCost: undefined,
            outputCost: undefined,
            totalCost: usd,
          },
        });
      } catch {
        /* idem */
      }
    },
    error(err) {
      try {
        generation.update({
          level: "ERROR",
          statusMessage: err instanceof Error ? err.message : String(err),
        });
      } catch {
        /* idem */
      }
    },
  };

  try {
    const result = await fn(handle);
    generation.end();
    return result;
  } catch (err) {
    handle.error(err);
    generation.end({ level: "ERROR" });
    throw err;
  } finally {
    // flushAt: 1 já garante envio imediato; flushAsync por segurança em scripts curtos.
    try {
      await lf.flushAsync();
    } catch {
      /* idem */
    }
  }
}
