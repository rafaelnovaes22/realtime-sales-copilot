/**
 * Ingest: corpus/source/*.md → corpus/raw/corpus.raw.json
 *
 * 1. Lê todos os .md de corpus/source/
 * 2. Corrige mojibake (UTF-8 lido como Latin-1 nos arquivos originais)
 * 3. Parseia markdown → chunks por heading (H2/H3/H4)
 * 4. Persiste com metadata (source, headingPath, position, level)
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import type { Root, Heading, Content } from "mdast";

const SOURCE_DIR = "corpus/source";
const OUTPUT_DIR = "corpus/raw";
const OUTPUT_FILE = "corpus.raw.json";

const MIN_HEADING_LEVEL = 2;
const MAX_HEADING_LEVEL = 4;

type RawChunk = {
  id: string;
  source: string;
  headingPath: string[];
  level: number;
  content: string;
  position: number;
  charCount: number;
};

/**
 * Mojibake: arquivos originais foram salvos em UTF-8 mas alguma ferramenta
 * intermediária interpretou os bytes como Latin-1, gerando sequências como
 * "Ã©" no lugar de "é". Fix: re-encode latin1 → utf8.
 *
 * Heurística para evitar corromper arquivos já corretos: só aplica se o texto
 * contém o padrão clássico "Ã" seguido de outro byte alto.
 */
function fixMojibake(text: string): string {
  const looksMojibaked = /Ã[\x80-\xBF]|Â[\x80-\xBF]|â\x80\x9[CD]/.test(text);
  if (!looksMojibaked) return text;

  try {
    const fixed = Buffer.from(text, "latin1").toString("utf8");
    if (fixed.includes("�")) return text;
    return fixed;
  } catch {
    return text;
  }
}

function hashChunk(source: string, headingPath: string[], content: string): string {
  return createHash("sha1")
    .update(`${source}::${headingPath.join("/")}\n${content}`)
    .digest("hex")
    .slice(0, 12);
}

function extractHeadingText(node: Heading): string {
  let text = "";
  visit(node, "text", (n: { value: string }) => {
    text += n.value;
  });
  return text.trim();
}

function renderNodeToMarkdown(node: Content, src: string): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return "";
  return src.slice(start, end);
}

function chunkByHeadings(source: string, markdown: string): RawChunk[] {
  const tree = unified().use(remarkParse).parse(markdown) as Root;
  const chunks: RawChunk[] = [];
  const headingStack: { level: number; text: string }[] = [];

  let currentHeading: { level: number; text: string } | null = null;
  let bodyParts: string[] = [];
  let position = 0;

  const flush = () => {
    if (!currentHeading) return;
    const heading = currentHeading;
    const headingPath = [
      ...headingStack.filter((h) => h.level < heading.level).map((h) => h.text),
      heading.text,
    ];
    const content = bodyParts.join("\n\n").trim();
    if (content.length === 0) return;

    chunks.push({
      id: hashChunk(source, headingPath, content),
      source,
      headingPath,
      level: heading.level,
      content,
      position: position++,
      charCount: content.length,
    });
  };

  for (const node of tree.children) {
    if (node.type === "heading") {
      const heading = node as Heading;
      const level = heading.depth;

      if (level >= MIN_HEADING_LEVEL && level <= MAX_HEADING_LEVEL) {
        flush();

        while (
          headingStack.length > 0 &&
          headingStack[headingStack.length - 1]!.level >= level
        ) {
          headingStack.pop();
        }

        const text = extractHeadingText(heading);
        currentHeading = { level, text };
        headingStack.push({ level, text });
        bodyParts = [];
        continue;
      }
    }

    if (currentHeading) {
      bodyParts.push(renderNodeToMarkdown(node as Content, markdown));
    }
  }

  flush();
  return chunks;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.error(`Nenhum .md encontrado em ${SOURCE_DIR}/`);
    process.exit(1);
  }

  console.log(`Ingerindo ${files.length} arquivo(s) de ${SOURCE_DIR}/`);

  const allChunks: RawChunk[] = [];
  let totalMojibakeFixed = 0;

  for (const file of files) {
    const path = join(SOURCE_DIR, file);
    const raw = await readFile(path, "utf8");
    const fixed = fixMojibake(raw);
    if (fixed !== raw) totalMojibakeFixed++;

    const chunks = chunkByHeadings(file, fixed);
    allChunks.push(...chunks);

    const avgChars = chunks.length
      ? Math.round(chunks.reduce((s, c) => s + c.charCount, 0) / chunks.length)
      : 0;
    console.log(
      `  ${file}: ${chunks.length} chunks (média ${avgChars} chars, mojibake: ${
        fixed !== raw ? "corrigido" : "ok"
      })`,
    );
  }

  const outputPath = join(OUTPUT_DIR, OUTPUT_FILE);
  await writeFile(outputPath, JSON.stringify(allChunks, null, 2), "utf8");

  console.log(`\nTotal: ${allChunks.length} chunks → ${outputPath}`);
  console.log(`Mojibake corrigido em ${totalMojibakeFixed}/${files.length} arquivo(s).`);
}

main().catch((err) => {
  console.error("Ingest falhou:", err);
  process.exit(1);
});
