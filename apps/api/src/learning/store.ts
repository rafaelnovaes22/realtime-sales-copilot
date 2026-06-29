/**
 * Acesso de LEITURA às tabelas de aprendizado (feedback/suggestions).
 *
 * Pool próprio (read-only) — separado do write-pool do POC (apps/web-poc/db.ts)
 * para manter a direção de dependência (api não importa web-poc). Ambos leem
 * DATABASE_URL; no-op silencioso quando ausente (dev local sem Postgres).
 */

import pg from "pg";

const { Pool } = pg;
let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("railway.internal")
        ? false
        : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

export type WinningExample = { texto: string; gatilho: string; tipo: string };

/**
 * Exemplos vencedores p/ few-shot: sugestões que o closer aceitou SEM editar,
 * ou cuja venda avançou/fechou. Filtra por gatilho (e tipo, se houver) e tenant.
 */
export async function fetchWinningExamples(opts: {
  gatilho: string;
  tipo?: string | null;
  tenantId: string;
  limit?: number;
}): Promise<WinningExample[]> {
  const db = getPool();
  if (!db) return [];
  const limit = opts.limit ?? 3;

  // Junta feedback (sinal de aceitação/edição) com suggestions (tipo/outcome).
  const { rows } = await db.query(
    `SELECT COALESCE(NULLIF(f.final_text, ''), f.suggestion_text) AS texto,
            s.tipo AS tipo
       FROM feedback f
       JOIN suggestions s ON s.suggestion_id = f.suggestion_id
      WHERE $1 = ANY(f.gatilhos)
        AND (f.tenant_id = $2 OR f.tenant_id IS NULL)
        AND (
          (f.action = 'accepted' AND COALESCE(f.was_edited, false) = false)
          OR s.outcome IN ('won','advanced')
        )
      ORDER BY (s.outcome IN ('won','advanced')) DESC, f.ts DESC
      LIMIT $3`,
    [opts.gatilho, opts.tenantId, limit],
  );

  return rows.map((r) => ({
    texto: String(r.texto ?? "").trim(),
    gatilho: opts.gatilho,
    tipo: String(r.tipo ?? opts.tipo ?? ""),
  })).filter((e) => e.texto.length > 0);
}

export type LearningRow = {
  ts: Date;
  gatilhos: string[];
  tipo: string | null;
  closer_id: string | null;
  action: string;
  was_edited: boolean | null;
  edit_distance: number | null;
  outcome: string | null;
  latency_ms: number | null;
};

/** Linhas de feedback+suggestion para cálculo de indicadores (janela em dias). */
export async function fetchLearningRows(sinceDays: number): Promise<LearningRow[]> {
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query(
    `SELECT f.ts, f.gatilhos, s.tipo, f.closer_id, f.action,
            f.was_edited, f.edit_distance, s.outcome, f.latency_ms
       FROM feedback f
       LEFT JOIN suggestions s ON s.suggestion_id = f.suggestion_id
      WHERE f.ts >= NOW() - ($1 || ' days')::interval
      ORDER BY f.ts DESC`,
    [sinceDays],
  );
  return rows as LearningRow[];
}
