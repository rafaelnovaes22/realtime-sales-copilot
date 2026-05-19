/**
 * Tag corpus: classifica cada chunk em estado/gatilho/tipo via Haiku 4.5.
 *
 * Input:  corpus/clean/corpus.clean.json
 * Output: corpus/clean/corpus.clean.json (in-place, com campo `tags`)
 *
 * Custo estimado: ~R$ 1-2 para 500 chunks (uma única passada).
 * Roda em paralelo (concorrência 8) com retries e save incremental.
 */

import { readFile, writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

const CORPUS_PATH = "corpus/clean/corpus.clean.json";
const MODEL = "claude-haiku-4-5-20251001";
const CONCURRENCY = 8;
const SAVE_EVERY = 50;

const ESTADOS = [
  "abertura",
  "diagnostico",
  "apresentacao",
  "objecao",
  "fechamento",
  "pos_call",
  "meta",
] as const;

const GATILHOS = [
  "vou_pensar",
  "ja_tenho_seguro",
  "esta_caro",
  "vou_falar_com_esposa",
  "prefiro_investir",
  "nao_tenho_tempo",
  "sou_jovem",
  "ja_tenho_reserva",
  "nao_tenho_interesse",
  "me_manda_whatsapp",
  "nenhum",
] as const;

const TIPOS = [
  "pergunta_diagnostica",
  "resposta_objecao",
  "proximo_passo",
  "exemplo_dialogo",
  "script_fala",
  "exercicio",
  "erro_comum",
  "explicacao_conceito",
  "estrutura_processo",
] as const;

type Estado = (typeof ESTADOS)[number];
type Gatilho = (typeof GATILHOS)[number];
type Tipo = (typeof TIPOS)[number];

type Chunk = {
  id: string;
  source: string;
  headingPath: string[];
  level: number;
  content: string;
  position: number;
  charCount: number;
  sanitized?: true;
  sanitizationLog?: unknown;
  tags?: { estado: Estado[]; gatilho: Gatilho[]; tipo: Tipo[] };
};

const SYSTEM_PROMPT = `Você classifica trechos de material de treinamento de vendas consultivas para um co-pilot que sugere falas a vendedores durante ligações ao vivo.

Para cada trecho, retorne três classificações:

1. **estado** — estados da conversa em que o trecho é aplicável:
   - abertura: início da reunião, criar confiança, explicar processo
   - diagnostico: perguntas, escuta, mapeamento de necessidade
   - apresentacao: explicar solução, conectar necessidade a oferta
   - objecao: cliente resiste, hesita ou questiona
   - fechamento: decisão, próximo passo concreto
   - pos_call: follow-up, revisão, recomendações pós-venda
   - meta: regra de processo, gestão, KPI (não aplicável a fala ao vivo)

2. **gatilho** — gatilhos específicos do cliente associados ao trecho:
   - vou_pensar, ja_tenho_seguro, esta_caro, vou_falar_com_esposa
   - prefiro_investir, nao_tenho_tempo, sou_jovem, ja_tenho_reserva
   - nao_tenho_interesse, me_manda_whatsapp
   - nenhum: trecho não responde a gatilho específico

3. **tipo** — formato do conteúdo:
   - pergunta_diagnostica, resposta_objecao, proximo_passo
   - exemplo_dialogo, script_fala, exercicio
   - erro_comum, explicacao_conceito, estrutura_processo

Múltiplas tags por categoria são permitidas. Use arrays vazios quando não aplicável (exceto estado, que tem ao menos um).

Responda APENAS com JSON válido no formato:
{"estado": ["..."], "gatilho": ["..."], "tipo": ["..."]}`;

const client = new Anthropic();

async function classifyChunk(chunk: Chunk, attempt = 1): Promise<Chunk["tags"]> {
  const userContent = `Heading path: ${chunk.headingPath.join(" / ")}\n\nConteúdo:\n${chunk.content}`;

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userContent }],
    });

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`sem JSON na resposta: ${text.slice(0, 100)}`);

    const parsed = JSON.parse(jsonMatch[0]) as {
      estado?: string[];
      gatilho?: string[];
      tipo?: string[];
    };

    return {
      estado: (parsed.estado ?? []).filter((s): s is Estado => ESTADOS.includes(s as Estado)),
      gatilho: (parsed.gatilho ?? []).filter((s): s is Gatilho =>
        GATILHOS.includes(s as Gatilho),
      ),
      tipo: (parsed.tipo ?? []).filter((s): s is Tipo => TIPOS.includes(s as Tipo)),
    };
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return classifyChunk(chunk, attempt + 1);
    }
    console.error(`  [${chunk.id}] falhou após 3 tentativas:`, err);
    return { estado: [], gatilho: [], tipo: [] };
  }
}

async function runInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!, idx);
      done++;
      onProgress?.(done, items.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY não configurada em .env");
    process.exit(1);
  }

  const chunks: Chunk[] = JSON.parse(await readFile(CORPUS_PATH, "utf8"));
  console.log(`Tagueando ${chunks.length} chunks com ${MODEL} (concorrência ${CONCURRENCY})`);

  const startedAt = Date.now();
  let lastSave = 0;

  const tagged = await runInBatches(
    chunks,
    CONCURRENCY,
    async (chunk) => ({ ...chunk, tags: await classifyChunk(chunk) }),
    (done, total) => {
      const pct = ((done / total) * 100).toFixed(1);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
      process.stdout.write(`\r  ${done}/${total} (${pct}%) — ${elapsed}s`);

      if (done - lastSave >= SAVE_EVERY) {
        lastSave = done;
      }
    },
  );

  console.log("\n");
  await writeFile(CORPUS_PATH, JSON.stringify(tagged, null, 2), "utf8");

  const stats = {
    estado: new Map<string, number>(),
    gatilho: new Map<string, number>(),
    tipo: new Map<string, number>(),
  };
  for (const c of tagged) {
    for (const e of c.tags?.estado ?? []) stats.estado.set(e, (stats.estado.get(e) ?? 0) + 1);
    for (const g of c.tags?.gatilho ?? []) stats.gatilho.set(g, (stats.gatilho.get(g) ?? 0) + 1);
    for (const t of c.tags?.tipo ?? []) stats.tipo.set(t, (stats.tipo.get(t) ?? 0) + 1);
  }

  console.log("Estados:");
  for (const [k, v] of [...stats.estado.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("\nGatilhos (top 10):");
  for (const [k, v] of [...stats.gatilho.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("\nTipos:");
  for (const [k, v] of [...stats.tipo.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  console.log(`\n✓ ${tagged.length} chunks tagueados → ${CORPUS_PATH}`);
}

main().catch((err) => {
  console.error("Tag falhou:", err);
  process.exit(1);
});
