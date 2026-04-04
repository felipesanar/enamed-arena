

# Plano de Correção — Modo Offline de Prova

## Problemas Identificados

### P1 — `getAttempt` usa `.maybeSingle()` mas pode retornar 2+ rows (CRÍTICO)
`simuladosApi.getAttempt()` busca attempts com `.maybeSingle()` sem filtrar por status. Quando um usuário tem um attempt `offline_pending` e depois faz um online (ou vice-versa), a query retorna mais de uma row e falha com erro do PostgREST. Isso também afeta o `useSimuladoDetail` — o `userState` pode refletir o attempt errado (offline ao invés de online).

**Correção:** Adicionar `.order('created_at', { ascending: false }).limit(1).maybeSingle()` ou filtrar para pegar o attempt mais relevante (submitted > in_progress > offline_pending).

### P2 — `AnswerSheetPage` navega para resultado usando slug, mas a rota usa `:id` (BUG)
Na linha 118 do `AnswerSheetPage`:
```
navigate(`/simulados/${simulado?.slug ?? id}/resultado`)
```
A rota aceita tanto slug quanto UUID graças ao `getSimulado` que resolve ambos. Porém, a navegação do `FloatingOfflineTimer` e do banner em `SimuladosPage` usa `simulado_slug` para construir `/simulados/:slug/gabarito`. Se o slug estiver vazio (campo é `''` como fallback), a navegação quebra.

**Correção:** Garantir que `simulado_slug` nunca seja string vazia no `create_offline_attempt_guarded` RPC e no `persistOfflineAttempt`.

### P3 — `finalize_attempt_with_results` exige `auth.uid()` mas é chamada dentro de `submit_offline_answers_guarded` (POTENCIAL BUG)
O RPC `submit_offline_answers_guarded` é `SECURITY DEFINER` e chama `finalize_attempt_with_results` que faz `WHERE user_id = auth.uid()`. Dentro de um `SECURITY DEFINER`, `auth.uid()` ainda funciona porque o contexto JWT é preservado. Isso está OK, mas vale verificar.

### P4 — PDF cacheado não invalida quando questões mudam
O Edge Function `generate-exam-pdf` cacheia o PDF por `simulado_id.pdf`. Se um admin editar questões, o PDF antigo será servido. Não há mecanismo de invalidação.

**Correção:** Incluir um hash ou timestamp no path do PDF, ou deletar o cache quando questões são atualizadas.

### P5 — `useOfflineAttempt` lança erro se query falhar, sem fallback gracioso
O hook faz `throw error` em `getActiveOfflineAttempt`. Se a query falhar (ex: rede offline), o React Query vai reintentar mas o `throw` pode causar um erro não capturado no retry loop, poluindo os logs.

**Correção:** O React Query captura o erro automaticamente, mas a função deveria retornar `null` em caso de erro de rede para manter resiliência offline.

### P6 — Timer não é pausado/limpo após submissão bem-sucedida do gabarito
Após `clearAttempt()` no `AnswerSheetPage`, o `FloatingOfflineTimer` some (porque `activeAttempt` fica null). Isso está OK.

### P7 — `handleSelect` no AnswerSheetPage tem bug na lógica de auto-advance
Na linha 72-73, a condição `next.id !== optionId` não faz sentido — compara o ID da questão com o ID da opção selecionada. Deveria verificar se a próxima questão já tem resposta.

**Correção:** Remover `&& next.id !== optionId` — a condição `!answers[next.id]` já é suficiente.

### P8 — Botão "Experiência Offline" aparece mesmo para simulados fora da janela de execução
O `HeroCardActive` renderiza o modal com opção offline, mas `create_offline_attempt_guarded` não bloqueia quando o simulado está fora da janela — ele cria o attempt com `is_within_window = false`. Isso é by design (treino), mas a UX não informa que não entrará no ranking.

**Correção:** Exibir aviso no modal quando fora da janela.

### P9 — `FloatingOfflineTimer` renderizado fora do `BrowserRouter`
Na `App.tsx` linha 60, o `FloatingOfflineTimer` está dentro do `BrowserRouter` (correto) mas fora das `Routes`. Ele usa `useNavigate()` — isso funciona porque está dentro do `BrowserRouter`. OK.

### P10 — Edge Function não valida JWT do usuário
A Edge Function `generate-exam-pdf` não verifica se o usuário autenticado tem permissão de gerar o PDF. Qualquer pessoa com o anon key pode gerar PDFs para qualquer simulado.

**Correção:** Adicionar validação do JWT e verificar se o usuário tem um attempt offline_pending para aquele simulado.

---

## Plano de Implementação

### Step 1 — Corrigir `getAttempt` para lidar com múltiplos attempts
- **Arquivo:** `src/services/simuladosApi.ts`
- **Mudança:** Adicionar ordenação por prioridade de status e `limit(1)`, ou trocar para query que retorne o attempt mais recente
- **Verificar:** Testar com usuário que tem attempt online + offline_pending

### Step 2 — Corrigir bug do auto-advance no AnswerSheetGrid
- **Arquivo:** `src/pages/AnswerSheetPage.tsx`
- **Mudança:** Remover `&& next.id !== optionId` da condição de auto-advance (linha 73)

### Step 3 — Tornar `getActiveOfflineAttempt` resiliente a erros de rede
- **Arquivo:** `src/services/offlineApi.ts`
- **Mudança:** Retornar `null` ao invés de `throw` em caso de erro, para manter resiliência offline

### Step 4 — Adicionar validação de JWT na Edge Function
- **Arquivo:** `supabase/functions/generate-exam-pdf/index.ts`
- **Mudança:** Extrair o JWT do header Authorization, verificar autenticação antes de gerar PDF

### Step 5 — Adicionar aviso de "fora da janela" no modal offline
- **Arquivo:** `src/pages/SimuladosPage.tsx`
- **Mudança:** Mostrar badge/aviso quando o simulado não está na janela de execução

### Step 6 — Invalidação de cache do PDF (baixa prioridade)
- **Arquivo:** `supabase/functions/generate-exam-pdf/index.ts`
- **Mudança:** Usar `simulado_id_<updated_at_timestamp>.pdf` como path, ou adicionar endpoint de invalidação

