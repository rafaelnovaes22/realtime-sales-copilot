# Interface do closer — painel ao vivo

## Como o closer acessa

Página web. Abre no notebook ou tablet ao lado da chamada no Zoom/Meet.
Sem instalação — só abrir o link e clicar em "iniciar ligação".

## Layout da tela

```
┌─────────────────────────────────────────────────────────────────┐
│  ● AO VIVO   Etapa: Diagnóstico   🎙 Closer 60%  Cliente 40%   │
├──────────────────────────┬──────────────────────────────────────┤
│                          │                                      │
│   TRANSCRIÇÃO AO VIVO    │   💡 SUGESTÃO                       │
│                          │                                      │
│   Cliente:               │  ┌────────────────────────────────┐ │
│   "Já tenho um plano     │  │ Pergunte: qual a cobertura     │ │
│   no banco, acho que     │  │ atual e há quanto tempo ele    │ │
│   tá bom..."             │  │ não revisa isso?               │ │
│                          │  └────────────────────────────────┘ │
│   Closer:                │                                      │
│   "Entendo, faz quanto   │  ┌────────────────────────────────┐ │
│   tempo você tem esse    │  │ Conecte: "Você sabe exatamente │ │
│   plano?"                │  │ o que está coberto hoje?"      │ │
│                          │  └────────────────────────────────┘ │
│   Cliente:               │                                      │
│   "Uns 8 anos, nunca     │        👍    👎    ✓ dispensar      │
│   mexi..."               │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

## Elementos da interface

### Barra superior
- **Indicador ao vivo** — ponto vermelho pulsando quando sessão ativa
- **Etapa atual** — onde a conversa está: Abertura / Diagnóstico / Objeção / Apresentação / Fechamento / Indicação
- **Balanço de fala** — percentual de tempo de fala do closer vs cliente; alerta sutil se closer está falando mais que 60%

### Coluna esquerda — Transcrição
- Texto aparece token a token conforme as pessoas falam
- Sem identificação de quem falou na versão MVP (v2 terá diarização)
- Scroll automático para o final

### Coluna direita — Sugestões
- Aparece somente quando um gatilho é detectado (não fica piscando o tempo todo)
- 1 a 3 cards por gatilho, máximo 2 linhas por card
- Botões por card:
  - 👍 foi útil
  - 👎 não foi útil
  - ✓ dispensar (sem avaliação)
- Cards somem após 30 segundos se o closer não interagir
- Nova sugestão substitui a anterior quando novo gatilho dispara

### Alertas de processo
- Banner amarelo discreto no topo quando o closer tenta pular etapa
- Exemplo: "Você ainda não concluiu o diagnóstico — cuidado antes de apresentar o plano"

## Antes de iniciar — Aviso LGPD

Antes de o closer clicar em "iniciar", aparece:

> "Esta sessão será transcrita por um sistema de assistência ao atendimento.
> Informe ao cliente que a chamada pode ser processada para fins de qualidade.
> Ao continuar, você confirma que o cliente foi avisado."

Botão: **Confirmar e iniciar** | Link: *Política de dados*

## Como usar na prática

1. Closer abre o painel no notebook (aba ao lado do Zoom/Meet)
2. Confirma o aviso LGPD
3. Clica "iniciar" — microfone começa a capturar
4. Faz a ligação normalmente
5. Lê os cards discretamente quando aparecem
6. Usa, descarta ou ignora — a conversa continua fluindo
7. Cliente não vê nem ouve nada do painel

## O que o cliente vê

Nada. O painel é somente para o closer. O bot não entra na chamada na versão MVP.
Na v2, com Recall.ai, o bot entra como participante silencioso (sem voz, sem câmera).
