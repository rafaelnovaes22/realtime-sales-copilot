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

import { getLLM } from "../src/llm/index.js";
import { GATILHOS } from "../apps/api/src/gatilhos.js";

const CORPUS_PATH = "corpus/clean/corpus.clean.json";
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

// Fonte única: os 18 gatilhos canônicos vêm de apps/api/src/gatilhos.ts.
// "nenhum" é exclusivo do tagger (trecho sem gatilho associado).
const GATILHOS_TAG = [...GATILHOS, "nenhum"] as const;

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
type GatilhoTag = (typeof GATILHOS_TAG)[number];
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
  tags?: { estado: Estado[]; gatilho: GatilhoTag[]; tipo: Tipo[] };
};

const SYSTEM_PROMPT = `Você classifica trechos de material de treinamento de vendas consultivas para um co-pilot que sugere falas a vendedores durante ligações ao vivo.

PRINCÍPIO CENTRAL: este material é uma REFERÊNCIA de método de vendas. As técnicas
(reframing, escuta, isolar o decisor, criar urgência, tratar preço) são TRANSFERÍVEIS
entre domínios. Classifique cada trecho pelo PADRÃO DE OBJEÇÃO que a técnica resolve —
NÃO pelo produto/domínio em que o exemplo foi escrito. Um trecho que ensina a tratar
ceticismo sobre "se a solução funciona" se aplica tanto a seguro quanto a "ia_nao_funciona".
Um trecho sobre isolar quem decide se aplica a "preciso_do_socio", "precisa_do_ti" e
"vou_falar_com_esposa". Marque TODOS os gatilhos cujo conceito de objeção o trecho ajuda
a tratar, mesmo que o exemplo original seja de outro contexto.

Para cada trecho, retorne três classificações:

1. **estado** — estados da conversa em que o trecho é aplicável:
   - abertura: início da reunião, criar confiança, explicar processo
   - diagnostico: perguntas, escuta, mapeamento de necessidade
   - apresentacao: explicar solução, conectar necessidade a oferta
   - objecao: cliente resiste, hesita ou questiona
   - fechamento: decisão, próximo passo concreto
   - pos_call: follow-up, revisão, recomendações pós-venda
   - meta: regra de processo, gestão, KPI (não aplicável a fala ao vivo)

2. **gatilho** — objeções/gatilhos do cliente que o trecho ajuda a tratar.
   Escolha os gatilhos aplicáveis:

   Universais (servem qualquer venda consultiva):
   - vou_pensar: cliente adia a decisão ("vou pensar", "preciso pensar")
   - esta_caro: objeção de preço/valor ("tá caro", "não vale a pena", "valor alto")
   - vou_falar_com_esposa: precisa consultar cônjuge/parceiro
   - preciso_do_socio: precisa consultar/aprovar com sócio
   - nao_tenho_tempo: falta de disponibilidade, agenda cheia
   - nao_tenho_interesse: desinteresse explícito
   - me_manda_whatsapp: pede contato por mensagem em vez de decidir
   - vou_pesquisar_mais: quer comparar/pesquisar outras opções
   - nao_funciona_pra_mim: "meu caso/negócio é diferente/específico"
   - prefiro_investir: prefere alocar o dinheiro em investimento financeiro

   B2B SaaS (concorrente, orçamento, garantia):
   - ja_usamos_outra_ferramenta: já tem CRM/sistema/planilha e está "atendido"
   - sem_orcamento_agora: sem verba/orçamento neste ciclo
   - quero_garantia: pede garantia de resultado, teme não funcionar

   B2B tech/IA (adoção e implementação):
   - ia_nao_funciona: ceticismo com IA ("já tentamos", "não entregou")
   - precisa_do_ti: precisa validar/aprovar com TI/CTO
   - dados_sensiveis: preocupação com privacidade/compliance/LGPD
   - equipe_nao_vai_usar: resistência de adoção/cultura
   - quanto_tempo_implementar: dúvida sobre prazo de implementação

   - nenhum: trecho não responde a gatilho específico

3. **tipo** — formato do conteúdo:
   - pergunta_diagnostica, resposta_objecao, proximo_passo
   - exemplo_dialogo, script_fala, exercicio
   - erro_comum, explicacao_conceito, estrutura_processo

Múltiplas tags por categoria são permitidas. Use arrays vazios quando não aplicável (exceto estado, que tem ao menos um).

Responda APENAS com JSON válido no formato:
{"estado": ["..."], "gatilho": ["..."], "tipo": ["..."]}`;

const llmPromise = getLLM("tagger");

async function classifyChunk(chunk: Chunk, attempt = 1): Promise<Chunk["tags"]> {
  const userContent = `Heading path: ${chunk.headingPath.join(" / ")}\n\nConteúdo:\n${chunk.content}`;

  try {
    const llm = await llmPromise;
    const resp = await llm.complete({
      system: SYSTEM_PROMPT,
      user: userContent,
      maxTokens: 200,
      cacheSystem: true,
      tenantId: "novais-digital-internal",
      traceName: "tag-corpus-classifier",
    });

    const jsonMatch = resp.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`sem JSON na resposta: ${resp.text.slice(0, 100)}`);

    const parsed = JSON.parse(jsonMatch[0]) as {
      estado?: string[];
      gatilho?: string[];
      tipo?: string[];
    };

    return {
      estado: (parsed.estado ?? []).filter((s): s is Estado => ESTADOS.includes(s as Estado)),
      gatilho: (parsed.gatilho ?? []).filter((s): s is GatilhoTag =>
        GATILHOS_TAG.includes(s as GatilhoTag),
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
  if (!process.env.GCP_PROJECT && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      "Nenhum provider configurado: defina GCP_PROJECT (Gemini/Vertex primário) ou ANTHROPIC_API_KEY (fallback) em .env",
    );
    process.exit(1);
  }

  const chunks: Chunk[] = JSON.parse(await readFile(CORPUS_PATH, "utf8"));
  const llm = await llmPromise;
  console.log(`Tagueando ${chunks.length} chunks com ${llm.modelId} (concorrência ${CONCURRENCY})`);

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
