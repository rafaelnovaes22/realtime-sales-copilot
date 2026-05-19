/**
 * Guardian regex: última linha de defesa antes de exibir sugestão ao closer.
 *
 * Bloqueia se:
 *   - leak de marca/programa proprietário (regex do brand-glossary.auditCheck)
 *   - mais de 2 linhas
 *   - mais de 280 caracteres
 *   - vazio ou só whitespace
 */

import { readFileSync } from "node:fs";

const GLOSSARY_PATH = "corpus/glossary/brand-glossary.json";

type Glossary = { auditCheck: string[] };

let GUARDIAN_REGEX: RegExp | null = null;

function loadGuardianRegex(): RegExp {
  if (!GUARDIAN_REGEX) {
    const glossary = JSON.parse(readFileSync(GLOSSARY_PATH, "utf8")) as Glossary;
    GUARDIAN_REGEX = new RegExp(glossary.auditCheck.join("|"), "i");
  }
  return GUARDIAN_REGEX;
}

export const MAX_LINES = 2;
export const MAX_CHARS = 280;

export type GuardianResult =
  | { ok: true; text: string }
  | { ok: false; reason: string; text: string };

export function guard(text: string): GuardianResult {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: "vazio", text: trimmed };
  }

  if (trimmed.length > MAX_CHARS) {
    return { ok: false, reason: `>${MAX_CHARS} chars (${trimmed.length})`, text: trimmed };
  }

  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length > MAX_LINES) {
    return { ok: false, reason: `>${MAX_LINES} linhas (${lines.length})`, text: trimmed };
  }

  const re = loadGuardianRegex();
  const leak = trimmed.match(re);
  if (leak) {
    return { ok: false, reason: `brand leak: ${leak[0]}`, text: trimmed };
  }

  return { ok: true, text: trimmed };
}
