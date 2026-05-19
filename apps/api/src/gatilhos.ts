/**
 * 10 gatilhos principais do MVP. Cada regex é aplicada sobre os últimos 30s
 * da transcrição. A escolha foi: cobertura ampla > precisão cirúrgica, porque
 * falsos positivos são filtrados depois pelo retriever (que só puxa chunks
 * realmente associados ao gatilho).
 */

export const GATILHOS = [
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
] as const;

export type Gatilho = (typeof GATILHOS)[number];

export const GATILHO_PATTERNS: Record<Gatilho, RegExp> = {
  vou_pensar: /\b(vou|preciso|deixa eu|me da[ ´]?u? um tempo pra|tenho que) pensar\b/i,
  ja_tenho_seguro:
    /\b(j[áa] (tenho|fiz|sou) (um |uma )?(segur|ap[óo]lice|cobertura|seguradora|plano de sa[úu]de)|j[áa] sou segurad)/i,
  esta_caro: /\b((t[áa]|est[áa]|fica|achei) caro|n[ãa]o vale a pena|caro demais|valor (muito )?alto|sai caro)\b/i,
  vou_falar_com_esposa:
    /\b(falar com (a |o )?(minha |meu )?(esposa|marido|mulher|c[ôo]njuge|companhei|parceir|patr[ãa]o)|consultar (a |o )?(minha |meu )?(esposa|marido))\b/i,
  prefiro_investir:
    /\b(prefiro investir|melhor investir|invisto (em outra coisa|por conta)|deixar (o dinheiro )?(rendendo|investido)|aplico (em )?(cdb|fundo|tesouro))\b/i,
  nao_tenho_tempo:
    /\b(n[ãa]o tenho tempo|sem tempo|t[ôo] corrid|estou ocupad|agora n[ãa]o|hor[áa]rio apertado|t[ôo] sem tempo)\b/i,
  sou_jovem:
    /\b(sou (muito )?jovem|sou (muito )?novo|tenho \d{1,2} anos|cedo demais (pra|para)|n[ãa]o (preciso|chegou) (disso|essa hora))\b/i,
  ja_tenho_reserva:
    /\b(j[áa] tenho reserva|tenho (dinheiro|patrim[ôo]nio) guardado|tenho economia|tenho investimento|j[áa] tenho (uma )?(poupan[çc]a|reserva financeira))\b/i,
  nao_tenho_interesse: /\b(n[ãa]o (tenho|t[óo]) interesse|n[ãa]o (me )?interess[oa]|n[ãa]o quero (saber|isso))\b/i,
  me_manda_whatsapp:
    /\b((manda|envia|me passa)( (por|no))? (whats|zap|mensagem)|por whatsapp|me passa por (texto|mensagem))\b/i,
};

export function detectGatilhos(text: string): Gatilho[] {
  const detected: Gatilho[] = [];
  for (const gatilho of GATILHOS) {
    if (GATILHO_PATTERNS[gatilho].test(text)) {
      detected.push(gatilho);
    }
  }
  return detected;
}
