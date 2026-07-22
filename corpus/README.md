# Corpus — pipeline de conhecimento do co-pilot

## Estrutura

```
corpus/
├── source/         # MDs originais com mojibake e marca (gitignored — IP-sensitive)
├── raw/            # JSON pós-ingest: encoding corrigido, chunks por heading (gitignored)
├── clean/          # JSON pós-sanitização: brand-free, tagged, embeddings (gitignored)
└── glossary/
    ├── brand-glossary.json    # termos proprietários → substituição genérica
    └── taxonomia-50-temas.json # destilação do arquivo de templates
```

## Por que `source/` é gitignored

Os MDs fonte derivam de material proprietário de capacitação comercial. Mesmo após sanitização no `clean/`, manter a origem em git history expõe IP. Os arquivos ficam apenas na máquina local de quem prepara o corpus.

## Pipeline

1. `npm run ingest` — lê `source/*.md`, corrige mojibake (Ã©→é, Ã£→ã, â→"), parse markdown → chunks por heading. Output: `raw/corpus.raw.json`.
2. `npm run sanitize` — aplica `brand-glossary.json`, valida via `auditCheck`, descarta chunks com leakage residual. Output: `clean/corpus.clean.json`.
3. `npm run tag` — taggea cada chunk com `estado_aplicavel`, `gatilho_relacionado`, `tipo_sugestao`. Output: `clean/corpus.clean.json` (in-place).
4. `npm run corpus` — encadeia os três.

## Arquivos source esperados (MVP)

- `50-aulas-vendas-consultivas.md` — 50 aulas com diálogos e role plays
- `aulas-completas-com-exemplos.md` — conteúdo modular com scripts

O arquivo `50_treinamentos_completos_adicionais_novos_assuntos.md` foi reduzido a `glossary/taxonomia-50-temas.json` por ser template repetitivo (decisão equivalente a D002).

Os arquivos `resumo_executivo_*` e `dossie_*` são metadocumentos de pesquisa, **não entram no corpus**.
