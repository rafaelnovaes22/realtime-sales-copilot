# MVP — 2 semanas: sugestão ao vivo durante a ligação

## Objetivo

Provar o conceito central do co-pilot: o closer vê a transcrição da ligação em tempo real e recebe sugestões de IA no momento exato em que precisa, em menos de 3 segundos.

Nada mais. Foco total na feature que valida o produto.

## Escopo do MVP

### Entra

- Transcrição ao vivo da ligação (Deepgram browser SDK, PT-BR, <300ms)
- Detecção de gatilhos via regex/keyword (10 principais: "vou pensar", "já tenho", "é caro", "vou falar com minha esposa", etc.)
- Gerador de sugestão (Sonnet 4.6 com corpus em contexto)
- Cards de sugestão na tela do closer (1-3 cards, 1-2 linhas cada)
- Indicador de etapa da conversa (abertura → diagnóstico → objeção → fechamento)
- Alerta quando closer tenta pular etapa
- Balanço de tempo de fala (closer vs cliente)
- Aviso LGPD antes de iniciar (texto simples na tela)

### Fica para v2

- Diarização closer vs cliente (v1: microfone captura tudo)
- Recall.ai / bot Zoom — v1: browser captura mic do notebook
- Login / auth
- Banco de dados / histórico de ligações
- Pós-call summary
- Dashboard do gestor
- Self-harness / aprendizado contínuo
- CRM integration

## Cronograma

```
SEMANA 1 — Motor

Seg-Ter   Corpus
          • Limpar e sanitizar os 6 MDs manualmente (encoding + brand)
          • Chunkar por heading → array de objetos {texto, tags}
          • Tagging manual dos 10 gatilhos principais por chunk

          Deepgram
          • Browser SDK: captura microfone → transcrição PT-BR ao vivo
          • Testar latência e acurácia com amostras reais

Qua-Qui   Pipeline de sugestão
          • Regex/keyword para detecção de gatilho no buffer de texto
          • Chamada Sonnet 4.6: estado + gatilho + últimos 30s + chunks relevantes
          • Guardian regex: zero brand leakage antes de exibir
          • Validar latência fim-a-fim (gatilho → card na tela) < 3s

Sex       Integração
          • Transcrição → buffer → detecção → sugestão → evento no frontend
          • Teste end-to-end com áudio gravado (simulação de ligação)

SEMANA 2 — Produto

Seg-Ter   Frontend (Next.js, página única)
          • Layout: transcrição à esquerda, cards à direita
          • Barra superior: etapa atual + balanço de fala
          • Cards com 👍/👎/✓dispensar
          • Aviso LGPD antes de iniciar
          • Alerta de processo (pulo de etapa)

Qua-Qui   Testes ao vivo
          • 1-2 closers em ligações reais
          • Medir: latência real, utilidade das sugestões, falsos positivos
          • Ajustar limiar de quando sugerir (menos é mais)

Sex       Demo
          • Página estável, link compartilhável
          • Pronto para demonstrar para a CEO e closers
```

## Gate de validação (fim da semana 2)

- [ ] Transcrição aparece em tempo real sem delay perceptível
- [ ] Sugestão aparece em ≤3s após gatilho detectado
- [ ] Zero leakage de marca nas sugestões
- [ ] ≥1 closer testou em ligação real e confirmou utilidade
- [ ] Aviso LGPD exibido antes de toda sessão

## Stack do MVP

| Componente | Tecnologia | Justificativa |
|---|---|---|
| Transcrição | Deepgram JS SDK (browser) | Sem backend de captura; funciona direto no browser |
| Corpus retrieval | In-memory + keyword search | Sem pgvector; simples e rápido para MVP |
| Detecção de gatilho | Regex/keyword | Sem Haiku; zero latência adicional |
| Gerador de sugestão | Sonnet 4.6 (API) | Qualidade máxima onde importa |
| Guardian | Regex determinístico | Zero custo, zero latência |
| Frontend | Next.js + Tailwind | Stack padrão Acme |
| Hosting | Railway (existente) | Sem setup de infra novo |

## O que esta versão prova

1. A latência de sugestão ≤3s é alcançável
2. O corpus de vendas gera sugestões contextualmente corretas
3. O closer consegue usar sem interromper o fluxo da ligação
4. A UX do painel é compreensível sem treinamento

## Caminho pós-aprovação

Se o MVP validar o conceito → iniciar v2 (4 semanas adicionais):
- Recall.ai para captura diarizada (closer vs cliente)
- Auth + banco de dados + histórico
- Pós-call summary automático
- Dashboard do gestor
