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

const PORT = 3001;

const app = new Hono();

app.get("/api/dg-key", (c) => {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key || key.startsWith("...")) {
    return c.json({ error: "DEEPGRAM_API_KEY ausente em .env" }, 500);
  }
  return c.json({ key });
});

app.use(
  "/*",
  serveStatic({
    root: resolve(import.meta.dirname, "public"),
  }),
);

serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`POC Deepgram rodando em http://localhost:${port}`);
  console.log(`Abre no Chrome/Edge e clica em "Iniciar". Mic precisa ser permitido.`);
});
