/**
 * Sanitização de PII (LGPD) — última barreira antes de persistir texto de
 * conversa (buffer_excerpt, final_text) que será usado para aprendizado.
 *
 * Redação conservadora de identificadores diretos: e-mail, CPF, CNPJ, telefone
 * e sequências longas de dígitos. NÃO substitui pseudonimização completa, mas
 * remove os identificadores diretos mais comuns em PT-BR. Validar com
 * security-privacy-guardian antes de SHADOW.
 */

const PATTERNS: Array<{ re: RegExp; tag: string }> = [
  { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi, tag: "[email]" },
  { re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, tag: "[cpf]" },
  { re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, tag: "[cnpj]" },
  // Telefone BR: (xx) 9xxxx-xxxx, +55..., com ou sem separadores
  { re: /(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, tag: "[telefone]" },
  // Sequências longas de dígitos (cartão, conta, etc.)
  { re: /\b\d{6,}\b/g, tag: "[numero]" },
];

export function sanitizePII(text: string): string {
  let out = text;
  for (const { re, tag } of PATTERNS) {
    out = out.replace(re, tag);
  }
  return out;
}

/** Distância de edição (Levenshtein) — quão longe o texto final ficou do sugerido. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}
