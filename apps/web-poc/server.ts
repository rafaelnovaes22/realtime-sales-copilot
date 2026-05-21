/**
 * POC server: serve a página estática + endpoint que entrega a Deepgram API key
 * para o browser (apenas em localhost, modo dev).
 *
 * Não usar em produção. Em produção, gerar token temporário via Deepgram
 * Management API com TTL curto e scopes restritos.
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";

import { run } from "../api/src/pipeline.js";
import {
  ensureSchema,
  insertFeedback,
  insertSuggestion,
  fetchFeedback,
  getPool,
} from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3001);

const FEEDBACK_DIR = resolve(__dirname, "../../feedback");
const FEEDBACK_FILE = resolve(FEEDBACK_DIR, "feedback.jsonl");

if (!existsSync(FEEDBACK_DIR)) mkdirSync(FEEDBACK_DIR, { recursive: true });

// Inicializa schema Postgres (no-op silencioso se DATABASE_URL ausente)
ensureSchema().catch((err) => console.error("[db] schema init failed:", err));

type FeedbackAction = "accepted" | "rejected" | "dismissed";

function saveFeedbackFallback(record: object) {
  // Fallback JSONL só quando não há Postgres (dev local)
  const line = JSON.stringify(record, null, 0);
  appendFileSync(FEEDBACK_FILE, line + "\n", { encoding: "utf8" });
}

const ESTADOS_VALIDOS = new Set([
  "abertura",
  "diagnostico",
  "apresentacao",
  "objecao",
  "fechamento",
]);

const app = new Hono();

app.get("/api/dg-key", (c) => {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key || key.startsWith("...")) {
    return c.json({ error: "DEEPGRAM_API_KEY ausente em .env" }, 500);
  }
  return c.json({ key });
});

app.post("/api/suggest", async (c) => {
  let body: { buffer?: string; estado?: string; suggestion_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json body" }, 400);
  }

  if (typeof body.buffer !== "string" || body.buffer.trim().length === 0) {
    return c.json({ error: "buffer is required (non-empty string)" }, 400);
  }

  const estado =
    body.estado && ESTADOS_VALIDOS.has(body.estado)
      ? (body.estado as "abertura" | "diagnostico" | "apresentacao" | "objecao" | "fechamento")
      : undefined;

  try {
    const result = await run({ buffer: body.buffer, estado });
    const suggestionText = result.guardian?.ok ? result.guardian.text : "";
    const suggestionId = body.suggestion_id ?? `${Date.now().toString(36)}`;

    // Persiste sugestão gerada para análise futura
    if (result.status === "ok" && suggestionText) {
      insertSuggestion({
        suggestion_id: suggestionId,
        status: result.status,
        gatilhos: result.gatilhos,
        suggestion_text: suggestionText,
        buffer_excerpt: body.buffer.slice(-300),
        total_latency_ms: result.totalLatencyMs,
        generation_latency_ms: result.generation?.latencyMs ?? null,
        cost_brl: result.generation?.costBrl ?? null,
        chunks_used: result.chunks.length,
      }).catch((err) => console.error("[db] insertSuggestion failed:", err));
    }

    return c.json({
      suggestion_id: suggestionId,
      status: result.status,
      gatilhos: result.gatilhos,
      suggestion: suggestionText || null,
      blocked_reason: result.status === "blocked_by_guardian" ? result.reason : null,
      chunks_used: result.chunks.length,
      total_latency_ms: result.totalLatencyMs,
      generation_latency_ms: result.generation?.latencyMs ?? null,
      cost_brl: result.generation?.costBrl ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `pipeline failed: ${msg}` }, 500);
  }
});

app.post("/api/feedback", async (c) => {
  let body: {
    suggestion_id?: string;
    action?: FeedbackAction;
    suggestion_text?: string;
    gatilhos?: string[];
    buffer_excerpt?: string;
    latency_ms?: number;
    cost_brl?: number;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json body" }, 400);
  }

  const validActions: FeedbackAction[] = ["accepted", "rejected", "dismissed"];
  if (!body.action || !validActions.includes(body.action)) {
    return c.json({ error: "action must be accepted | rejected | dismissed" }, 400);
  }

  const record = {
    suggestion_id: body.suggestion_id ?? "unknown",
    action: body.action,
    gatilhos: body.gatilhos ?? [],
    suggestion_text: body.suggestion_text ?? "",
    buffer_excerpt: body.buffer_excerpt ?? "",
    latency_ms: body.latency_ms ?? null,
    cost_brl: body.cost_brl ?? null,
  };

  console.log(`[feedback] ${JSON.stringify(record)}`);

  if (getPool()) {
    insertFeedback(record).catch((err) =>
      console.error("[db] insertFeedback failed:", err),
    );
  } else {
    saveFeedbackFallback({ ts: new Date().toISOString(), ...record });
  }

  return c.json({ ok: true });
});

app.get("/api/feedback/export", async (c) => {
  if (getPool()) {
    const rows = await fetchFeedback().catch(() => []);
    return c.json({ records: rows, total: rows.length, source: "postgres" });
  }
  // Fallback JSONL
  if (!existsSync(FEEDBACK_FILE)) {
    return c.json({ records: [], total: 0, source: "jsonl" });
  }
  const { readFileSync } = await import("node:fs");
  const lines = readFileSync(FEEDBACK_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  return c.json({ records: lines, total: lines.length, source: "jsonl" });
});

app.use(
  "/*",
  serveStatic({
    root: resolve(__dirname, "public"),
  }),
);

serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  const storage = process.env.DATABASE_URL ? "Postgres" : "JSONL (fallback)";
  console.log(`POC Deepgram rodando em http://localhost:${port}`);
  console.log(`Storage: ${storage}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /api/dg-key`);
  console.log(`  POST /api/suggest        { buffer, estado? }`);
  console.log(`  POST /api/feedback       { suggestion_id, action, suggestion_text, gatilhos, buffer_excerpt }`);
  console.log(`  GET  /api/feedback/export`);
});
