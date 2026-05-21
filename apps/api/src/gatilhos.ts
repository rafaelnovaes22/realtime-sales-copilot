/**
 * 18 gatilhos — cobre dois contextos de venda:
 *   • Educação executiva (ClientC): programas, mentoria, imersão
 *   • B2B tech/IA (Acme): co-pilot, Aicfo, SchoolPlatform, Social
 *
 * Cobertura ampla > precisão cirúrgica — falsos positivos são filtrados
 * pelo retriever (que só puxa chunks associados ao gatilho).
 */

export const GATILHOS = [
  // Universais (servem ambos os contextos)
  "vou_pensar",
  "esta_caro",
  "vou_falar_com_esposa",
  "preciso_do_socio",
  "nao_tenho_tempo",
  "nao_tenho_interesse",
  "me_manda_whatsapp",
  "vou_pesquisar_mais",
  "nao_funciona_pra_mim",
  // Educação executiva (ClientC)
  "ja_fiz_curso",
  "proxima_turma",
  "online_nao_funciona",
  "prefiro_investir",
  // B2B tech/IA (Acme)
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

  // ── Educação executiva (ClientC) ──────────────────────────────────────────────

  ja_fiz_curso:
    /\b(j[áa] fiz (um |uma )?(curso|treinamento|mentoria|capacita[çc][ãa]o|imers[ãa]o)|j[áa] estudei (isso|sobre isso|esse assunto)|j[áa] tenho (um |uma )?(curso|mentoria|coach)|j[áa] passei por (isso|treinamento))\b/i,

  proxima_turma:
    /\b(na pr[óo]xima turma|pr[óo]xima (edi[çc][ãa]o|vers[ãa]o|turma)|quando abrir (de novo|outra turma)|me chama quando|avisa quando tiver|entro (na pr[óo]xima|depois))\b/i,

  online_nao_funciona:
    /\b(curso online (n[ãa]o funciona|eu n[ãa]o consigo|n[ãa]o aprendo)|n[ãa]o consigo (aprender|focar|estudar) online|presencial (funciona mais|[ée] melhor)|online n[ãa]o [ée] pra mim|prefiro presencial)\b/i,

  prefiro_investir:
    /\b(prefiro investir|melhor investir|invisto (em outra coisa|por conta)|deixar (o dinheiro )?(rendendo|investido)|aplico (em )?(cdb|fundo|tesouro)|esse dinheiro (rende|renderia) mais)\b/i,

  // ── B2B tech/IA (Acme) ─────────────────────────────────────────────────

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
