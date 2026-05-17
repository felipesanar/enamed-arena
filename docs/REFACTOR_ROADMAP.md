# Refactor Roadmap — `enamed-arena`

Este documento captura três refactors estruturais identificados no code review
de 2026-05-16 que **não** foram executados na PR de hardening por serem grandes
demais para revisar com segurança numa única iteração. O objetivo aqui é deixar
um plano concreto para a próxima pessoa pegar.

A PR de hardening corrigiu tudo que era localizado: segurança de Edge Functions,
bugs de hooks pontuais, dirty tracking, dependência com CVE, headers de
produção e CI. Os três itens abaixo precisam de iteração mais longa.

---

## 1. Decompor `useExamFlow` (god hook — 646 linhas)

### Por que importa

`src/hooks/useExamFlow.ts` é o motor da prova. Toda mudança de produto
relacionada à execução de simulado toca este arquivo, e ele concentra
responsabilidades que precisam ser testadas isoladamente:

- Init / resume / finalize de attempt
- Redirect de elegibilidade
- Focus tracking + integrity events
- Timer + auto-submit
- `beforeunload` + `fetch keepalive`
- Atalhos de teclado
- Analytics
- Navegação entre questões + handlers de resposta

Hoje **não há testes unitários** porque o hook só faz sentido em integração.
Refactor desbloqueia testes e reduz risco de regressão em cada PR.

### Plano

Decompor em sub-hooks coesos. Manter `useExamFlow` como camada de composição
fina (<150 linhas), responsável apenas por costurar as partes:

```
src/hooks/exam/
├── useExamLifecycle.ts      ← init/resume/finalize + redirects
├── useExamIntegrity.ts      ← focus tracking + integrity events
├── useExamAnswers.ts        ← handlers de resposta + dirty tracking
├── useExamShortcuts.ts      ← keyboard shortcuts (já existe useKeyboardShortcuts)
├── useExamBeacon.ts         ← beforeunload + fetch keepalive
└── index.ts                 ← re-exports
```

Cada um tem 80–200 linhas, recebe deps explícitas e retorna API pequena.
`useExamFlow` vira:

```ts
export function useExamFlow(): UseExamFlowReturn {
  const lifecycle = useExamLifecycle({ ... });
  const integrity = useExamIntegrity({ onTabExit, onFullscreenExit });
  const answers = useExamAnswers({ updateState: lifecycle.updateState });
  const timer = useExamTimer({ deadline, onTimeUp: lifecycle.finalize });
  // ...
  return { ...lifecycle, ...integrity, ...answers, timer };
}
```

### Riscos / mitigação

- **Mudar a ordem de hooks quebra React.** Mitigação: cada sub-hook deve
  ser puro (sem hooks condicionais) e composto na mesma ordem do original.
- **Refs compartilhadas (`stateRef`, `simuladoRef`) atravessam módulos.**
  Solução: subir essas refs para `useExamFlow` e passar como argumento.

### Testes a adicionar (cobertura mínima)

1. `useExamLifecycle`: init-from-scratch, resume in-progress, deadline-passed → auto-submit, network failure → enqueue reprocessing.
2. `useExamIntegrity`: tab exit/return updates count + analytics; fullscreen exit triggers toast.
3. `useExamAnswers`: select option marks dirty; eliminate option toggles correctly.

**Esforço:** 3–5 dias com testes.

---

## 2. Decompor god components

### Arquivos afetados

| Arquivo | Linhas | Sintomas |
|---------|--------|----------|
| `src/components/ranking/RankingView.tsx` | 1297 | filtros + tabela + chart + modais juntos |
| `src/pages/CadernoErrosPage.tsx` | 1140 | filtros + listagem + edição inline + delete confirm |
| `src/components/desempenho/DesempenhoSimuladoPanel.tsx` | 1066 | KPIs + áreas + temas + drill-down |

### Plano (template aplicável aos três)

Para `RankingView`:

```
src/components/ranking/
├── RankingView.tsx              ← orchestrator (<200 linhas)
├── RankingFilters.tsx           ← segment/comparison/specialty selectors
├── RankingStatsHeader.tsx       ← KPIs (total, média, corte)
├── RankingTable.tsx             ← lista virtualizada (React.memo)
├── RankingChart.tsx             ← distribution chart
└── hooks/
    └── useRankingFilters.ts    ← state dos filtros + persistencia
```

Critérios para extrair:
- Componente tem >150 linhas, OU
- Componente tem >3 responsabilidades visuais, OU
- Mudar uma seção força re-render de seções não relacionadas.

Cada filho com `React.memo` + props estáveis. Para tabelas longas considerar
`@tanstack/react-virtual` (não adiciona ao bundle se carregado só onde usado).

**Esforço:** 2–3 dias por componente. Total ~7 dias.

---

## 3. Migrar para TypeScript `strict: true`

### Estado atual

`tsconfig.app.json` tem `strictNullChecks: false` e `noImplicitAny: false`.
Resultado:

- `null`/`undefined` casuais (vide `as any` proliferado em `adminApi.ts`)
- Casts `(supabase.rpc as any)` em ~20 lugares
- Erros que só aparecem em runtime

### Estratégia incremental (não big-bang)

1. **Fase 1 — `noImplicitAny: true`** (1–2 dias).
   Habilitar globalmente; refatorar arquivos quebrados. Maioria são tipos
   de parâmetros faltando.

2. **Fase 2 — `strictNullChecks: true`** (3–5 dias).
   Habilitar globalmente; corrigir `?.` e `??` onde TS exigir. Use
   `// @ts-expect-error` como TODO temporário para acessos que precisam
   ser revisitados depois.

3. **Fase 3 — `"strict": true`** (1 dia, mais limpeza).
   Inclui `strictFunctionTypes`, `strictBindCallApply`, `alwaysStrict`,
   `useUnknownInCatchVariables`. Mais cosmético — pegará principalmente
   `catch (err) { err.message }` que vira `unknown`.

4. **Fase 4 — Regenerar Supabase types** (independente).
   Setup: `npm run supabase:gen-types` → `supabase gen types typescript
   --project-id $PROJECT_ID > src/integrations/supabase/types.ts`. Adicionar
   ao CI para falhar se há divergência. Remove necessidade dos casts
   `(supabase.rpc as any)`.

### Como medir progresso

```
# Quantos `any` ainda existem
grep -r " as any\b" src/ --include="*.ts" --include="*.tsx" | wc -l

# Quantos arquivos têm @ts-expect-error
grep -rl "@ts-expect-error" src/
```

**Esforço total:** 5–8 dias úteis distribuídos. Pode ser feito gradualmente
por arquivo via `// @ts-strict` directive de bibliotecas como
`@typescript-eslint/strict-checks` se a equipe preferir.

---

## 4. Outros débitos identificados no review (já listados no relatório)

- **E2E smoke test no Playwright** (configurado, sem specs). ~1 dia.
- **Edge Function tests** (Deno test) para `sso-magic-link`,
  `create-guest-account`. ~2 dias.
- **Bundle analysis** com `vite-bundle-visualizer` — verificar chunks após
  troca de xlsx → exceljs.

---

## Como retomar

1. Crie uma branch por refactor (`refactor/use-exam-flow-decomposition`).
2. Abra PRs pequenos por sub-hook / sub-componente — facilita revisão.
3. Adicione cobertura de teste **antes** de cada decomposição grande para
   detectar regressões automaticamente.
4. Não combine refactor com mudança de comportamento na mesma PR.
