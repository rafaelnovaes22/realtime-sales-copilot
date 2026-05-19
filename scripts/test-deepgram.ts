/**
 * Smoke test do Deepgram: valida API key, lista projetos e transcreve um
 * trecho curto de áudio pré-hospedado para confirmar PT-BR + modelo.
 *
 * Uso: npm run test:deepgram
 */

import { createClient } from "@deepgram/sdk";

const apiKey = process.env.DEEPGRAM_API_KEY;
if (!apiKey || apiKey.trim() === "" || apiKey.startsWith("...")) {
  console.error("DEEPGRAM_API_KEY não configurada em .env");
  process.exit(1);
}

const SAMPLE_AUDIO_URL = "https://dpgr.am/spacewalk.wav";

async function main() {
  const deepgram = createClient(apiKey);

  console.log("→ Validando API key (GET /v1/projects)...");
  const projectsResp = await deepgram.manage.getProjects();
  if (projectsResp.error) {
    console.error("  Falhou:", projectsResp.error);
    process.exit(1);
  }
  const projects = projectsResp.result?.projects ?? [];
  console.log(`  OK — ${projects.length} projeto(s): ${projects.map((p) => p.name).join(", ")}`);

  console.log("\n→ Transcrevendo amostra em inglês (modelo nova-3)...");
  const enResp = await deepgram.listen.prerecorded.transcribeUrl(
    { url: SAMPLE_AUDIO_URL },
    {
      model: "nova-3",
      smart_format: true,
      punctuate: true,
    },
  );
  if (enResp.error) {
    console.error("  Falhou:", enResp.error);
    process.exit(1);
  }
  const enTranscript = enResp.result?.results?.channels[0]?.alternatives[0]?.transcript;
  console.log(`  OK — "${enTranscript?.slice(0, 120)}..."`);

  console.log("\n→ Validando suporte PT-BR (mesma amostra, language=pt-BR)...");
  const ptResp = await deepgram.listen.prerecorded.transcribeUrl(
    { url: SAMPLE_AUDIO_URL },
    {
      model: "nova-2",
      language: "pt-BR",
      smart_format: true,
      punctuate: true,
    },
  );
  if (ptResp.error) {
    console.error("  Falhou:", ptResp.error);
    process.exit(1);
  }
  const ptTranscript = ptResp.result?.results?.channels[0]?.alternatives[0]?.transcript;
  console.log(
    `  OK — nova-2 com language=pt-BR aceita. Output (esperado lixo, áudio é em inglês): "${ptTranscript?.slice(0, 80)}..."`,
  );

  console.log("\n✓ Deepgram configurado. Pronto para captura ao vivo no browser.");
}

main().catch((err) => {
  console.error("Smoke test falhou:", err);
  process.exit(1);
});
