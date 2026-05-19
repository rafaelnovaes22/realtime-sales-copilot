/**
 * Teste end-to-end da pipeline com transcrições simuladas.
 * Mede latência fim-a-fim para validar o SLA do MVP (≤3s).
 *
 * Uso: npm run test:pipeline
 */

import { run } from "../apps/api/src/pipeline.js";

const CENARIOS: { nome: string; estado?: "abertura" | "diagnostico" | "apresentacao" | "objecao" | "fechamento"; buffer: string }[] = [
  {
    nome: "Cliente: 'está caro'",
    estado: "apresentacao",
    buffer:
      "Closer: Então o plano que faz sentido para o seu caso seria de mil reais mensais, cobrindo proteção da família e do financiamento.\n" +
      "Cliente: Tá caro, hein. Pensei que fosse algo mais em conta.",
  },
  {
    nome: "Cliente: 'vou pensar'",
    estado: "fechamento",
    buffer:
      "Closer: Então essa estrutura cobre a renda da família e o financiamento, conforme conversamos. Faz sentido a gente formalizar?\n" +
      "Cliente: Olha, acho que vou pensar. Preciso conversar com calma antes.",
  },
  {
    nome: "Cliente: 'prefiro investir esse dinheiro'",
    estado: "apresentacao",
    buffer:
      "Closer: Pelo diagnóstico, sua família teria reserva para uns quatro meses. Eu sugiro uma proteção que cobre o gap entre essa reserva e o financiamento.\n" +
      "Cliente: Sei. Mas prefiro investir esse dinheiro em renda fixa. Já tô aplicando em CDB.",
  },
  {
    nome: "Cliente: 'já tenho seguro'",
    estado: "abertura",
    buffer:
      "Closer: Antes de falar de qualquer alternativa, queria entender se existe alguma exposição na sua família em caso de imprevisto.\n" +
      "Cliente: Olha, já tenho um seguro. Comprei faz uns anos pelo banco.",
  },
  {
    nome: "Sem gatilho (conversa normal)",
    estado: "diagnostico",
    buffer:
      "Closer: E quem hoje depende financeiramente da sua renda?\n" +
      "Cliente: Minha esposa e dois filhos. Minha mulher trabalha também, mas a maior parte vem de mim.",
  },
];

function formatChunkLine(c: { chunk: { id: string; headingPath: string[] }; score: number; reasons: string[] }): string {
  const path = c.chunk.headingPath.join(" / ").slice(0, 70);
  return `      [${c.chunk.id}] score=${c.score} (${c.reasons.join(", ")})\n        ${path}`;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY não configurada em .env");
    process.exit(1);
  }

  console.log(`Testando pipeline com ${CENARIOS.length} cenários\n`);

  const latencias: number[] = [];

  for (const cenario of CENARIOS) {
    console.log(`━━━ ${cenario.nome} ━━━`);
    console.log(`Buffer (estado=${cenario.estado ?? "?"}):`);
    for (const line of cenario.buffer.split("\n")) {
      console.log(`  ${line}`);
    }

    const result = await run({ buffer: cenario.buffer, estado: cenario.estado });

    console.log(`\n  Gatilhos detectados: ${result.gatilhos.length > 0 ? result.gatilhos.join(", ") : "(nenhum)"}`);

    if (result.status === "no_gatilho") {
      console.log(`  → SEM SUGESTÃO (nenhum gatilho casou) — ${result.totalLatencyMs}ms`);
      console.log();
      continue;
    }

    console.log(`  Chunks usados (${result.chunks.length}):`);
    for (const c of result.chunks) {
      console.log(formatChunkLine(c));
    }

    if (result.generation) {
      console.log(
        `\n  Geração: ${result.generation.latencyMs}ms (in=${result.generation.inputTokens}, out=${result.generation.outputTokens} tokens)`,
      );
    }

    if (result.status === "blocked_by_guardian") {
      console.log(`  ✗ BLOQUEADO PELO GUARDIAN: ${result.reason}`);
      console.log(`    texto bruto: "${result.generation?.text}"`);
    } else if (result.guardian?.ok) {
      console.log(`\n  ✓ SUGESTÃO:`);
      console.log(`    "${result.guardian.text}"`);
    }

    console.log(`\n  ⏱  Latência total: ${result.totalLatencyMs}ms ${result.totalLatencyMs <= 3000 ? "✓" : "⚠ EXCEDEU 3s"}\n`);
    latencias.push(result.totalLatencyMs);
  }

  if (latencias.length > 0) {
    const sorted = [...latencias].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    const max = sorted[sorted.length - 1];
    console.log(`Latência: p50=${p50}ms  p95=${p95}ms  max=${max}ms  (SLA: ≤3000ms)`);
  }
}

main().catch((err) => {
  console.error("Test falhou:", err);
  process.exit(1);
});
