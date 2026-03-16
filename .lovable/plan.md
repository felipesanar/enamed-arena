

## Diagnóstico: Respostas NÃO são salvas no banco de dados

### O Bug

Existe uma desconexão crítica entre o fluxo de UI e a persistência no Supabase:

1. Quando o aluno seleciona uma resposta, `handleSelectOption` chama `updateState` → `saveStateDebounced`
2. `saveStateDebounced` salva no **localStorage** e agenda um `syncToDb` debounced
3. `syncToDb` sincroniza metadados do attempt (current_question_index, tab_exit_count, etc.) E depois tenta sincronizar respostas de `pendingAnswersRef.current`
4. **Problema**: `storage.trackAnswer()` — a função que adiciona respostas ao `pendingAnswersRef` — **nunca é chamada** em nenhum lugar do código

Resultado: o `pendingAnswersRef` está **sempre vazio**. As respostas existem apenas no localStorage, nunca chegam à tabela `answers` do Supabase. Na finalização, `flushPendingState` também não encontra nada para enviar.

### O Fix

**Arquivo: `src/pages/SimuladoExamPage.tsx`**

Nos handlers `handleSelectOption` e `handleEliminateOption`, após atualizar o state, chamar `storage.trackAnswer(questionId, answer)` para enfileirar a resposta para sincronização com o DB.

Alternativa mais robusta (e mais simples): modificar `syncToDb` em `useExamStorageReal.ts` para extrair as respostas diretamente do `state.answers` passado como parâmetro, em vez de depender de um ref separado (`pendingAnswersRef`). Isso elimina a necessidade de chamar `trackAnswer` manualmente e garante que **todas** as respostas são sincronizadas.

### Plano de Implementação

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useExamStorageReal.ts` | Alterar `syncToDb` para sincronizar **todas** as respostas do `state.answers` via `bulkUpsertAnswers`, eliminando a dependência do `pendingAnswersRef` |
| `src/pages/SimuladoExamPage.tsx` | Adicionar chamada a `storage.trackAnswer()` em `handleSelectOption` e `handleEliminateOption` como safety net |

A abordagem dupla garante que: (a) o sync debounced sempre envia tudo, e (b) o trackAnswer marca respostas individuais para flush rápido na finalização.

