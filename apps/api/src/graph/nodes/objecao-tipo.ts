/**
 * Mapeamento conceitual gatilho → tipo de objeção + prompt-hints de roteamento.
 *
 * O "tipo" agrupa gatilhos pelo PADRÃO de objeção (não pelo domínio), espelhando
 * o princípio de tagging transferível do corpus. Usado pelo classifier (fallback
 * determinístico) e pelo roteamento que injeta o hint no gerador.
 */

import type { Gatilho } from "../../gatilhos.js";
import type { ObjTipo } from "../state.js";

const TIPO_BY_GATILHO: Record<Gatilho, ObjTipo> = {
  // preço / valor
  esta_caro: "preco",
  prefiro_investir: "preco",
  sem_orcamento_agora: "preco",
  // autoridade / decisor terceiro
  preciso_do_socio: "autoridade",
  precisa_do_ti: "autoridade",
  vou_falar_com_esposa: "autoridade",
  // ceticismo / "não funciona" / risco
  ia_nao_funciona: "ceticismo_tech",
  nao_funciona_pra_mim: "ceticismo_tech",
  quero_garantia: "ceticismo_tech",
  // timing / adiamento
  vou_pensar: "timing",
  nao_tenho_tempo: "timing",
  quanto_tempo_implementar: "timing",
  // status quo / já resolvido / risco de mudar
  ja_usamos_outra_ferramenta: "status_quo",
  dados_sensiveis: "status_quo",
  equipe_nao_vai_usar: "status_quo",
  // brush-off / dispensa
  nao_tenho_interesse: "brush_off",
  me_manda_whatsapp: "brush_off",
  vou_pesquisar_mais: "brush_off",
};

export function gatilhoToTipo(g: Gatilho): ObjTipo {
  return TIPO_BY_GATILHO[g];
}

/** Hint injetado no prompt do gerador conforme o tipo de objeção. */
export const PROMPT_HINTS: Record<ObjTipo, string> = {
  preco:
    "Objeção de PREÇO/VALOR: não defenda o preço. Reframe para o custo de NÃO agir e o valor do resultado. Faça a comparação certa (custo do problema vs. investimento).",
  autoridade:
    "Objeção de AUTORIDADE (decisor terceiro): valide a consulta, mas faça uma pergunta que isole o que ELE precisa para recomendar internamente, e ofereça munição para essa conversa.",
  ceticismo_tech:
    "Objeção de CETICISMO ('não funciona'/'já tentei'): NUNCA minimize o risco. Reconheça a experiência ruim e redirecione para um piloto/diagnóstico de baixo risco que prova valor.",
  timing:
    "Objeção de TIMING/adiamento: traga o custo da inação no tempo. Faça uma pergunta que revela a urgência real por trás do 'depois'.",
  status_quo:
    "Objeção de STATUS QUO ('já tenho'/'minha equipe não vai usar'/'dados sensíveis'): reconheça o que já existe e mostre a lacuna específica que o atual não cobre, sem desmerecer.",
  brush_off:
    "Objeção BRUSH-OFF (dispensa rápida): não aceite o adiamento de imediato. Faça UMA pergunta curta de valor que reabre a conversa sem pressionar.",
};
