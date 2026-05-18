# ADR-001 — Stack técnica

**Status:** PENDENTE — aguarda confirmação no Step 0

## Contexto

O co-pilot exige captura de áudio ao vivo, STT streaming em PT-BR com diarização, orquestração em tempo real com latência ≤3s e interface web responsiva.

## Decisões recomendadas

### Captura de áudio
- **Recomendado:** Recall.ai — bot entra na chamada como participante, separa áudio por participante na origem, suporta Zoom/Meet/Teams nativamente.
- **Alternativa:** Extensão Chrome com `tabCapture` — mais barata, mais frágil, requer manutenção quando o Zoom Web muda.
- **Fallback telefônico:** Bridge SIP via Twilio.
- **Decisão pendente:** confirmar orçamento Recall.ai e volume esperado de chamadas/mês.

### STT
- **Recomendado:** Deepgram — melhor latência em PT-BR (<300ms), diarização nativa, endpointing automático, punctuação + smart format.
- **Alternativa:** AssemblyAI — qualidade similar, latência levemente maior.
- **Descartado:** Whisper self-host — latência incompatível com tempo real (<300ms exigido).
- **Decisão pendente:** testar ambos com amostras reais de ligações PT-BR antes de travar.

### Backend
- **Recomendado:** Hono — mais leve que Fastify, excelente suporte a WebSocket, TypeScript nativo, edge-ready.
- **Alternativa:** Fastify — mais maduro, maior ecossistema de plugins.
- **Decisão pendente:** preferência da equipe de desenvolvimento.

### Auth
- **Recomendado:** Clerk — integração Next.js nativa, painel de usuários, SSO, suporte a multi-tenant (útil para escalar para corretoras parceiras).
- **Alternativa:** Supabase Auth — gratuito, integra com Postgres.
- **Alternativa:** NextAuth — open source, mais controle, mais trabalho de setup.
- **Decisão pendente:** verificar se Acme já usa algum desses nos outros produtos.

### Hosting
- **MVP:** Railway (alinhado com infraestrutura atual Acme).
- **Produção escalonada:** GCP — Cloud Run (API), Cloud SQL (Postgres), GCS (áudios), Pub/Sub (fila de pós-call).
- **Decisão travada:** Railway no MVP, migração GCP planejada para Step 10.

## Consequências

Travar essas decisões no Step 0 desbloqueia a implementação do Step 5 (backend) sem retrabalho de arquitetura.
