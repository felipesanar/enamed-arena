

## Plano: Permitir simulados fora da janela (sem ranking)

### Resumo

Atualmente, o sistema **bloqueia** o acesso ao simulado fora da janela de execução (tanto no frontend quanto no backend via `create_attempt_guarded`). A mudança é: alunos podem fazer o simulado a qualquer momento, mas tentativas fora da janela **não contam no ranking**.

### Mudanças necessárias

#### 1. Banco de dados — Coluna `is_within_window` na tabela `attempts`

Adicionar coluna booleana `is_within_window` (default `true`) à tabela `attempts`. Essa flag é calculada no momento da criação da tentativa e determina se o resultado entra no ranking.

#### 2. Backend — Atualizar `create_attempt_guarded`

Remover as validações que bloqueiam criação de tentativas fora da janela (`RAISE EXCEPTION 'window has not started'` e `'window has ended'`). Em vez disso, calcular `is_within_window` baseado em se `now()` está dentro de `[execution_window_start, execution_window_end]` e gravar na tentativa. O cálculo de deadline precisa ser adaptado: fora da janela, usar apenas `duration_minutes` sem o `LEAST` com `execution_window_end`.

#### 3. Backend — Atualizar `get_ranking_for_simulado`

Adicionar filtro `AND a.is_within_window = true` para que apenas tentativas realizadas dentro da janela sejam consideradas no ranking.

#### 4. Frontend — Status e navegação (`simulado-helpers.ts`)

- Remover bloqueio de `canAccessSimulado` para simulados com janela expirada. Simulados passam a ser `available` (ou novo status como `available_late`) quando a janela fechou mas o usuário ainda não fez.
- Ajustar `deriveSimuladoStatus`: se a janela acabou, o usuário **não** fez, e o resultado já saiu → status permite acesso para treino.
- Manter `closed_waiting` apenas para quem já finalizou e aguarda resultado.

#### 5. Frontend — `useExamFlow.ts` gate

Remover/ajustar o redirect que impede acesso quando `!canAccessSimulado(simulado.status)`. Permitir acesso em status `available_late` / simulados com janela expirada.

#### 6. Frontend — `SimuladoDetailPage.tsx`

- Mostrar CTA "Iniciar Simulado (Treino)" para simulados com janela expirada.
- Exibir aviso claro: "Este simulado está fora da janela de execução. Seu resultado não será considerado no ranking."

#### 7. Frontend — `SimuladoCard.tsx`

- Atualizar para exibir estado adequado para simulados fora da janela (ex: "Disponível para treino").

#### 8. Frontend — Tela de resultado / Ranking

- Na tela pós-prova (`ExamCompletedScreen`), indicar se a tentativa foi fora da janela.
- Na página de ranking, tentativas fora da janela já são excluídas pelo backend (passo 3).

### Detalhes técnicos

```text
attempts table
┌──────────────────────┐
│ + is_within_window   │  boolean, default true
└──────────────────────┘

create_attempt_guarded()
  REMOVE: window start/end checks (RAISE EXCEPTION)
  ADD:    v_in_window := (v_now >= v_simulado.execution_window_start 
                      AND v_now <= v_simulado.execution_window_end)
  ADD:    deadline = duration only (no LEAST) when outside window
  STORE:  is_within_window = v_in_window

get_ranking_for_simulado()
  ADD:    WHERE ... AND a.is_within_window = true

SimuladoStatus (types/index.ts)
  ADD:    'available_late'  — window passed, user can still do as practice

deriveSimuladoStatus()
  CHANGE: after windowEnd, if user never finished → 'available_late'
          (instead of 'closed_waiting')

canAccessSimulado()
  ADD:    'available_late' → true
```

### Ordem de execução

1. Migration: add `is_within_window` column
2. Migration: update `create_attempt_guarded` function
3. Migration: update `get_ranking_for_simulado` function
4. Code: update types (`SimuladoStatus` + `STATUS_CONFIG`)
5. Code: update `simulado-helpers.ts` (status derivation, CTA, tests)
6. Code: update `useExamFlow.ts` gate
7. Code: update `SimuladoDetailPage.tsx` (new CTA + warning)
8. Code: update `SimuladoCard.tsx` (new status display)
9. Code: update `ExamCompletedScreen.tsx` (out-of-window indicator)

