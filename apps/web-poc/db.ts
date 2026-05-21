/**
 * Conexão Postgres para persistência de feedback.
 * Cria a tabela automaticamente no primeiro start (sem Prisma, sem migrations).
 * Fallback silencioso para JSONL se DATABASE_URL ausente (dev local).
 */

import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("railway.internal")
        ? false
        : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function ensureSchema(): Promise<void> {
  const db = getPool();
  if (!db) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id            BIGSERIAL PRIMARY KEY,
      ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      suggestion_id TEXT        NOT NULL,
      action        TEXT        NOT NULL CHECK (action IN ('accepted','rejected','dismissed')),
      gatilhos      TEXT[]      NOT NULL DEFAULT '{}',
      suggestion_text TEXT      NOT NULL DEFAULT '',
      buffer_excerpt  TEXT      NOT NULL DEFAULT '',
      latency_ms    INTEGER,
      cost_brl      NUMERIC(10,6)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id            BIGSERIAL PRIMARY KEY,
      ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      suggestion_id TEXT        NOT NULL UNIQUE,
      status        TEXT        NOT NULL,
      gatilhos      TEXT[]      NOT NULL DEFAULT '{}',
      suggestion_text TEXT      NOT NULL DEFAULT '',
      buffer_excerpt  TEXT      NOT NULL DEFAULT '',
      total_latency_ms INTEGER,
      generation_latency_ms INTEGER,
      cost_brl      NUMERIC(10,6),
      chunks_used   INTEGER
    )
  `);
}

export async function insertFeedback(record: {
  suggestion_id: string;
  action: string;
  gatilhos: string[];
  suggestion_text: string;
  buffer_excerpt: string;
  latency_ms: number | null;
  cost_brl: number | null;
}): Promise<void> {
  const db = getPool();
  if (!db) return;

  await db.query(
    `INSERT INTO feedback
       (suggestion_id, action, gatilhos, suggestion_text, buffer_excerpt, latency_ms, cost_brl)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      record.suggestion_id,
      record.action,
      record.gatilhos,
      record.suggestion_text,
      record.buffer_excerpt,
      record.latency_ms,
      record.cost_brl,
    ],
  );
}

export async function insertSuggestion(record: {
  suggestion_id: string;
  status: string;
  gatilhos: string[];
  suggestion_text: string;
  buffer_excerpt: string;
  total_latency_ms: number | null;
  generation_latency_ms: number | null;
  cost_brl: number | null;
  chunks_used: number;
}): Promise<void> {
  const db = getPool();
  if (!db) return;

  await db.query(
    `INSERT INTO suggestions
       (suggestion_id, status, gatilhos, suggestion_text, buffer_excerpt,
        total_latency_ms, generation_latency_ms, cost_brl, chunks_used)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (suggestion_id) DO NOTHING`,
    [
      record.suggestion_id,
      record.status,
      record.gatilhos,
      record.suggestion_text,
      record.buffer_excerpt,
      record.total_latency_ms,
      record.generation_latency_ms,
      record.cost_brl,
      record.chunks_used,
    ],
  );
}

export async function fetchFeedback(): Promise<object[]> {
  const db = getPool();
  if (!db) return [];
  const result = await db.query(
    `SELECT * FROM feedback ORDER BY ts DESC LIMIT 1000`,
  );
  return result.rows;
}
