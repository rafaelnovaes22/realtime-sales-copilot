/**
 * Observability — C6 (telemetry by default).
 *
 * Wrapper sobre LangSmith com ativação opcional via env vars. Quando
 * `LANGCHAIN_API_KEY` (ou `LANGSMITH_API_KEY`) está ausente, vira no-op
 * silencioso — não bloqueia desenvolvimento sem conta. Quando presente,
 * cria um Run do tipo `llm` no LangSmith por chamada `observe()`, com
 * input/output/usage anexados.
 *
 * Princípio C6 exige instrumentação no código — esta camada satisfaz
 * isso. Ativação em produção (criar conta LangSmith, preencher env vars,
 * validar `trace_coverage ≥ 99%` por 7 dias) é gate antes de SHADOW.
 *
 * Uso típico (dentro de um LLM adapter):
 *
 *   return observe(
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

import { RunTree } from "langsmith";

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

function getConfig() {
  const apiKey = process.env.LANGCHAIN_API_KEY ?? process.env.LANGSMITH_API_KEY;
  if (!apiKey || apiKey.startsWith("...") || apiKey.trim() === "") return null;

  const project =
    process.env.LANGCHAIN_PROJECT ?? process.env.LANGSMITH_PROJECT ?? "realtime-sales-copilot";

  const tracingEnabled =
    process.env.LANGCHAIN_TRACING_V2 === "true" ||
    process.env.LANGSMITH_TRACING === "true" ||
    apiKey !== undefined; // se a key existe, tratamos como opt-in implícito

  if (!tracingEnabled) return null;

  return { apiKey, project };
}

export function isObservabilityActive(): boolean {
  return getConfig() !== null;
}

/**
 * Executa `fn` com instrumentação LangSmith. Se LangSmith não estiver
 * configurado, executa fn com handle no-op — comportamento idêntico do
 * ponto de vista do caller.
 *
 * Nunca lança por falha de telemetria. Erros do `fn` propagam normalmente.
 */
export async function observe<T>(
  options: ObserveOptions,
  fn: (trace: TraceHandle) => Promise<T>,
): Promise<T> {
  const config = getConfig();

  if (!config) {
    const noopHandle: TraceHandle = {
      input: () => {},
      output: () => {},
      cost: () => {},
      error: () => {},
    };
    return fn(noopHandle);
  }

  // Estado capturado pelos métodos do handle e usado no end()
  let inputs: unknown = undefined;
  let outputs: unknown = undefined;
  let usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
  let costBrl: number | undefined;
  let errorMsg: string | undefined;

  const handle: TraceHandle = {
    input(payload) {
      inputs = payload;
    },
    output(payload) {
      outputs = payload;
    },
    cost({ brl, inputTokens, outputTokens }) {
      costBrl = brl;
      usage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: (inputTokens ?? 0) + (outputTokens ?? 0),
      };
    },
    error(err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    },
  };

  const runTree = new RunTree({
    name: options.name,
    run_type: "llm",
    project_name: config.project,
    extra: {
      metadata: {
        ...options.metadata,
        tenant_id: options.tenantId,
        model: options.model,
      },
    },
  });

  try {
    await runTree.postRun().catch(() => {
      /* telemetria nunca derruba runtime */
    });
  } catch {
    /* idem */
  }

  try {
    const result = await fn(handle);

    runTree.inputs = (inputs ?? {}) as Record<string, unknown>;
    runTree.outputs = {
      ...((outputs ?? {}) as Record<string, unknown>),
      ...(usage ? { usage } : {}),
      ...(costBrl !== undefined ? { cost_brl: costBrl } : {}),
    };
    runTree.end_time = Date.now();

    try {
      await runTree.patchRun();
    } catch {
      /* idem */
    }

    return result;
  } catch (err) {
    handle.error(err);

    runTree.inputs = (inputs ?? {}) as Record<string, unknown>;
    runTree.outputs = (outputs ?? {}) as Record<string, unknown>;
    runTree.error = errorMsg ?? (err instanceof Error ? err.message : String(err));
    runTree.end_time = Date.now();

    try {
      await runTree.patchRun();
    } catch {
      /* idem */
    }

    throw err;
  }
}
