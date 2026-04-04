

# Bloquear envio de simulado com questões sem resposta

## Problema
Atualmente é possível enviar um simulado (online ou offline) mesmo com questões não respondidas. O requisito é que **todas** as questões devem estar respondidas antes de permitir o envio.

## Alterações

### 1. Modal de confirmação online (`SubmitConfirmModal.tsx`)
- Desabilitar o botão "Finalizar prova" quando `summary.unanswered > 0`
- Trocar o texto do botão para "Responda todas as questões" com estilo desabilitado
- Remover o alerta de "questões sem resposta" (warning box) — agora o botão desabilitado comunica isso diretamente
- Manter os botões de navegação para questões não respondidas para facilitar a localização

### 2. Botões de "Finalizar" na tela de prova (`SimuladoExamPage.tsx`)
- Nos 3 locais onde `setShowSubmitModal(true)` é chamado (header, footer desktop, navigator mobile), adicionar verificação: se `summary.unanswered > 0`, mostrar toast informativo ao invés de abrir o modal
- Alternativa: permitir abrir o modal mas com botão desabilitado (melhor UX pois mostra as questões faltantes)

### 3. Atalho de teclado Escape (`useExamFlow.ts`)
- Na linha 437, o `Escape` abre o modal — manter o comportamento (o botão estará desabilitado no modal)

### 4. Gabarito offline (`AnswerSheetPage.tsx`)
- O botão "Enviar gabarito" já tem `disabled={answeredCount === 0}`, trocar para `disabled={!allAnswered}`
- No modal de confirmação, desabilitar "Confirmar envio" quando `!allAnswered`
- Atualizar o texto do modal para refletir que todas devem ser respondidas

### 5. Guard no backend (defesa em profundidade)
- Na RPC `finalize_attempt_with_results`: adicionar check que conta questões sem resposta e levanta exceção se houver
- Na RPC `submit_offline_answers_guarded`: adicionar check similar antes de finalizar

## Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/exam/SubmitConfirmModal.tsx` | Desabilitar botão quando há questões sem resposta |
| `src/pages/AnswerSheetPage.tsx` | Bloquear envio quando `!allAnswered` |
| `src/pages/SimuladoExamPage.tsx` | Toast informativo se tentar finalizar incompleto (opcional) |
| Migration SQL | Guard nas RPCs `finalize_attempt_with_results` e `submit_offline_answers_guarded` |

