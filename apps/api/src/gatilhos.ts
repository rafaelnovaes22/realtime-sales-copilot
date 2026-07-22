/**
 * 18 gatilhos de objeção para venda consultiva B2B (produto de referência:
 * SaaS de gestão comercial). Dois grupos:
 *   • Universais: valem para qualquer venda consultiva
 *   • B2B SaaS/tech: preço, timing, concorrente, autoridade, garantia, adoção
 *
 * Cobertura ampla > precisão cirúrgica — falsos positivos são filtrados
 * pelo retriever (que só puxa chunks associados ao gatilho).
 */

export const GATILHOS = [
  // Universais (qualquer venda consultiva)
  "vou_pensar",
  "esta_caro",
  "vou_falar_com_esposa",
  "preciso_do_socio",
  "nao_tenho_tempo",
  "nao_tenho_interesse",
  "me_manda_whatsapp",
  "vou_pesquisar_mais",
  "nao_funciona_pra_mim",
  "prefiro_investir",
  // B2B SaaS (concorrente, orçamento, garantia)
  "ja_usamos_outra_ferramenta",
  "sem_orcamento_agora",
  "quero_garantia",
  // B2B tech/IA (adoção e implementação)
  "ia_nao_funciona",
  "precisa_do_ti",
  "dados_sensiveis",
  "equipe_nao_vai_usar",
  "quanto_tempo_implementar",
] as const;

export type Gatilho = (typeof GATILHOS)[number];

export const GATILHO_PATTERNS: Record<Gatilho, RegExp> = {
  // ── Universais ────────────────────────────────────────────────────────────

  vou_pensar:
    /\b(vou|preciso|deixa eu|me d[áa] um tempo pra|tenho que) pensar\b/i,

  esta_caro:
    /\b(t[áa]|est[áa]|fica|ficou|achei|achou|achando|achamos|ach[áa]vamos|sai|saiu|tava|tavam) (\w{2,15} )?caro\b|\b(muito caro|caro demais|n[ãa]o vale a pena|valor (muito )?alto|valor alto demais|pre[çc]o (muito )?alto|n[ãa]o cabe no (or[çc]amento|bolso))\b/i,

  vou_falar_com_esposa:
    /\b(falar com (a |o )?(minha |meu )?(esposa|marido|mulher|c[ôo]njuge|companhei|parceir|patr[ãa]o)|consultar (a |o )?(minha |meu )?(esposa|marido))\b/i,

  preciso_do_socio:
    /\b(falar com (o |a )?(meu |minha )?s[óo]cio|consultar (o |a )?(meu |minha )?s[óo]cio|ver com (o |a )?s[óo]cio|s[óo]cio precisa (ver|aprovar|decidir)|decid(e|imos) junto(s)?)\b/i,

  nao_tenho_tempo:
    /\b(n[ãa]o tenho tempo|sem tempo|t[ôo] corrid|estou ocupad|agora n[ãa]o|hor[áa]rio apertado|t[ôo] sem tempo|agenda cheia|cheio de compromisso|n[ãa]o temos bandwidth)\b/i,

  nao_tenho_interesse:
    /\b(n[ãa]o (tenho|t[óo]) interesse|n[ãa]o (me )?interess[oa]|n[ãa]o quero (saber|isso)|n[ãa]o (estou|to) afim)\b/i,

  me_manda_whatsapp:
    /\b((manda|envia|me passa)( (por|no))? (whats|zap|mensagem)|por whatsapp|me passa por (texto|mensagem))\b/i,

  vou_pesquisar_mais:
    /\b(vou (pesquisar|ver|olhar) (mais|outras op[çc][õo]es|outras alternativas)|deixa eu (pesquisar|ver outras|comparar)|vou (dar uma olhada|comparar)|tenho que (analisar|comparar) (mais|melhor))\b/i,

  nao_funciona_pra_mim:
    /\b(meu neg[óo]cio [ée] diferente|isso n[ãa]o (se aplica|funciona) (pra|para) (mim|n[óo]s)|meu caso [ée] (diferente|espec[íi]fico|outro)|n[ãa]o [ée] (pra|para) (mim|n[óo]s)|minha (realidade|situa[çc][ãa]o|opera[çc][ãa]o) [ée] diferente|nossa empresa [ée] muito espec[íi]fica)\b/i,

  prefiro_investir:
    /\b(prefiro investir|melhor investir|invisto (em outra coisa|por conta)|deixar (o dinheiro )?(rendendo|investido)|aplico (em )?(cdb|fundo|tesouro)|esse dinheiro (rende|renderia) mais)\b/i,

  // ── B2B SaaS (concorrente, orçamento, garantia) ───────────────────────────

  ja_usamos_outra_ferramenta:
    /\b(j[áa] (usamos|temos|trabalhamos com|uso|tenho) (um |uma |outro |outra )?(crm|sistema|ferramenta|plataforma|planilha|solu[çc][ãa]o)|(fazemos|faz|fa[çc]o|controlamos|resolvemos|resolve) (tudo )?(no excel|em planilha)|estamos (bem )?atendidos (com|pela))\b/i,

  sem_orcamento_agora:
    /\b(n[ãa]o (temos|tenho) (or[çc]amento|verba|budget)|sem (or[çc]amento|verba|budget)|or[çc]amento (fechado|congelado|estourado|s[óo] (no )?ano que vem)|verba (acabou|congelada|cortada)|s[óo] no pr[óo]ximo (ano|trimestre|semestre)|ano que vem a gente (v[êe]|conversa|fala))\b/i,

  quero_garantia:
    /\b(tem garantia|qual (a |[ée] a )?garantia|e se n[ãa]o (funcionar|der certo|entregar)|garante (o )?(resultado|retorno)|quem (me )?garante|posso cancelar (se|quando|a qualquer)|e se (eu|a gente) (n[ãa]o gostar|quiser sair))\b/i,

  // ── B2B tech/IA (adoção e implementação) ──────────────────────────────────

  ia_nao_funciona:
    /\b(j[áa] tentamos? (ia|intelig[êe]ncia artificial|automa[çc][ãa]o)|ia (n[ãa]o funciona|[ée] muito promessa|n[ãa]o entregou|decepcionou)|n[ãa]o acredito (em ia|nessa tecnologia)|intelig[êe]ncia artificial (n[ãa]o|ainda n[ãa]o) (funciona|resolve)|chatgpt n[ãa]o (serviu|funcionou|resolveu))\b/i,

  precisa_do_ti:
    /\b(precis(o|amos) (falar|consultar|validar) com (o )?ti|time de (ti|tecnologia) precisa (ver|avaliar|aprovar)|n[ãa]o (passo|passa) sem (o )?ti|cto precisa (ver|aprovar|avaliar)|diretor de ti|precisa da (equipe|[áa]rea) de tecnologia)\b/i,

  dados_sensiveis:
    /\b(nossos? dados|dados (s[ea]ns[íi]veis|confidenciais|sigilosos|da empresa)|n[ãa]o (podemos|posso) (expor|compartilhar|enviar) (dados|informa[çc][õo]es)|seguran[çc]a (dos dados|da informa[çc][ãa]o)|n[ãa]o (queremos|quero) dados (fora|na nuvem|em terceiros)|lgpd|compliance)\b/i,

  equipe_nao_vai_usar:
    /\b(minha (equipe|turma|time) n[ãa]o (vai|sabe|consegue) (usar|adotar|aprender)|resist[êe]ncia (da equipe|interna|do time)|n[ãa]o vejo (meu time|minha equipe) (usando|adotando)|mudan[çc]a de cultura|ado[çc][ãa]o [ée] dif[íi]cil|pessoal n[ãa]o (vai|gosta de) mudar)\b/i,

  quanto_tempo_implementar:
    /\b(quanto tempo (leva|demora|[ée]) (pra |para )?(implementar|implantar|colocar no ar|ficar pronto)|quando (fica pronto|estaria funcionando|podemos usar)|prazo de (implementa[çc][ãa]o|implanta[çc][ãa]o)|n[ãa]o temos? (tempo|prazo) (pra|para) (implementa[çc][ãa]o|projeto))\b/i,
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
