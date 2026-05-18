# Registro de decisões — Acme Forja Comercial

## Decisões travadas

| ID | Decisão | Data |
|---|---|---|
| D001 | Arquivo B (`aulas_completas_com_exemplos_treinamento_vendas.md`) é subset de C — descartado | 2026-05-18 |
| D002 | Arquivo A reduzido a `taxonomia-50-temas.json` — corpo descartado para evitar dominância no retrieval | 2026-05-18 |
| D003 | Sanitização de marcas no ingest, terminologia genérica, provenance interna mantida em metadado | 2026-05-18 |
| D004 | Foco P0: co-pilot em tempo real; Q&A offline é subproduto (P2) reaproveitando mesmo corpus | 2026-05-18 |
| D005 | Runtime: Claude Agent SDK + Hono + WebSocket + Next.js 14+ App Router | 2026-05-18 |
| D006 | Hosting inicial: Railway; migração GCP planejada para Step 10 | 2026-05-18 |
| D007 | Modelos: Sonnet 4.6 no gerador de sugestões; Haiku 4.5 nos detectores e guardian | 2026-05-18 |
| D008 | Guardian híbrido: regex determinístico para brand leakage + Haiku 4.5 para tom e tamanho | 2026-05-18 |
| D009 | Self-harness com gate humano obrigatório — nenhuma mudança vai a produção sem aprovação | 2026-05-18 |

## Decisões pendentes (Step 0)

| ID | Decisão | Contexto |
|---|---|---|
| P001 | Captura de áudio: Recall.ai vs extensão Chrome vs combinação | Recall.ai mais estável, extensão mais barata |
| P002 | STT: Deepgram vs AssemblyAI | Testar com amostras PT-BR reais |
| P003 | Auth: NextAuth vs Clerk vs Supabase Auth | Verificar o que Acme já usa nos outros produtos |
| P004 | CRM destino do pós-call | Qual ferramenta os closers usam hoje? |
| P005 | Texto LGPD do consentimento | Requer aprovação jurídica antes do Step 5 |
| P006 | Gate de aprovação de refino | Você + closer sênior, ou comitê incluindo CEO? |
| P007 | Closers do SHADOW | Definir 3-5 nomes antes do Step 6 |
