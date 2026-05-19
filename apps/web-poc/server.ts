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
import { resolve } from "node:path";

import { run } from "../api/src/pipeline.js";

const PORT = 3001;

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
  let body: { buffer?: string; estado?: string };
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
    return c.json({
      status: result.status,
      gatilhos: result.gatilhos,
      suggestion: result.guardian?.ok ? result.guardian.text : null,
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

app.use(
  "/*",
  serveStatic({
    root: resolve(import.meta.dirname, "public"),
  }),
);

serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`POC Deepgram rodando em http://localhost:${port}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /api/dg-key`);
  console.log(`  POST /api/suggest   { buffer, estado? }`);
});
