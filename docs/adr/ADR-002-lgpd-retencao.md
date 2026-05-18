# ADR-002 — Política de retenção de dados e LGPD

**Status:** PENDENTE — texto de consentimento requer aprovação jurídica antes do Step 5

## Contexto

O co-pilot captura e processa áudio de conversas entre closer e cliente. Isso exige conformidade explícita com a LGPD (Lei 13.709/2018), especialmente o art. 7º (hipóteses de tratamento) e art. 18º (direitos do titular).

## Política de retenção proposta

| Dado | Retenção | Justificativa |
|---|---|---|
| Arquivo de áudio | 30 dias | Mínimo para debug e auditoria de qualidade; após 30 dias, exclusão automática |
| Transcrição completa | 365 dias | Necessária para eval de qualidade e self-harness |
| Metadados anonimizados | Indefinido | Sem PII; usados para métricas agregadas e melhoria do modelo |
| Feedback do closer (👍/👎) | Indefinido | Dado comportamental não sensível, essencial para self-harness |
| Sugestões geradas | 365 dias | Necessário para correlação sugestão × resultado |

## Consentimento obrigatório

Antes de toda chamada:

1. Pop-up visível para o closer com texto pré-aprovado pelo jurídico.
2. Aviso automatizado para o cliente no início da chamada (via bot Recall.ai ou mensagem de áudio).
3. Registro do consentimento em banco de dados com timestamp e IP.
4. Opção de opt-out: cliente pode solicitar exclusão do áudio/transcrição a qualquer momento.
5. Exclusão dentro de 72h após solicitação.

## Texto de consentimento (rascunho — requer aprovação jurídica)

> "Esta chamada poderá ser gravada e transcrita por um sistema de assistência ao atendimento. As informações são usadas exclusivamente para melhorar a qualidade do serviço prestado a você. Você pode solicitar a exclusão da gravação a qualquer momento. Ao continuar, você consente com esses termos."

**Pendente:** enviar para o jurídico revisar e aprovar antes do Step 5.

## Base legal (LGPD)

- Art. 7º, inciso I: consentimento do titular.
- Art. 7º, inciso IX: legítimo interesse do controlador (melhoria de serviço), com aviso prévio.

## Consequências

Não iniciar captura de áudio em produção sem:
- [ ] Texto de consentimento aprovado pelo jurídico
- [ ] Mecanismo de opt-out implementado e testado
- [ ] Política de retenção configurada no storage (lifecycle rules no R2/S3/GCS)
- [ ] Registro de consentimento no banco de dados
