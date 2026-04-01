# enamed-arena — Instruções para Claude Code

## O que é este projeto

Plataforma de simulados cronometrados para residência médica (ENAMED / SanarFlix PRO).
Usuários fazem provas em janelas de execução, veem resultados, ranking por área, e assinantes PRO têm Caderno de Erros e comparativo.

## Stack

- **Build:** Vite 5.4 + TypeScript 5.8
- **UI:** React 18.3, React Router 6, shadcn/ui (Radix), Tailwind CSS 3.4, Framer Motion 12
- **Estado:** TanStack React Query 5 (staleTime 5min), Context API
- **Backend:** Supabase (Auth + Postgres com RLS + SECURITY DEFINER RPCs)
- **Testes:** Vitest 3 (jsdom), Testing Library, Playwright
- **Email:** Novu (via Edge Functions)

## Comandos

```bash
npm run dev        # Dev server na porta 8080
npm run build      # Build produção
npm run test       # Vitest (run único)
npm run test:watch # Vitest (watch)
npm run lint       # ESLint
```

## Estrutura

```
src/
├── App.tsx                    # Rotas + providers globais
├── components/
│   ├── ui/                    # shadcn components (não editar manualmente)
│   ├── exam/                  # Componentes da tela de prova
│   ├── premium/               # Layout premium (sidebar, topbar, home)
│   └── *.tsx                  # Componentes compartilhados
├── pages/                     # Uma página por rota
├── contexts/                  # AuthContext, UserContext
├── hooks/                     # Lógica de negócio (useExamFlow, useSimulados, etc.)
├── services/                  # simuladosApi.ts, rankingApi.ts (queries Supabase)
├── lib/                       # Helpers utilitários
├── types/                     # Tipos de domínio (index.ts, exam.ts)
└── integrations/supabase/     # client.ts, types.ts (gerados — não editar)
```

## Convenções de Código

- **Componentes:** PascalCase, arquivos `.tsx`
- **Hooks:** camelCase prefixado com `use`, arquivos `.ts`
- **Serviços:** camelCase, módulos com objeto exportado (ex: `simuladosApi.methodName`)
- **Tipos:** centralizados em `src/types/` — adicionar lá, não reinventar inline
- **Alias:** `@/` → `src/` (usar sempre, nunca paths relativos longos)
- **TypeScript:** `noImplicitAny: false`, `strictNullChecks: false` (projeto é relaxado)
- **Imports:** sem barril files; imports diretos

## Segmentos de Usuário

| Segmento | Label UI | Acesso |
|----------|----------|--------|
| `guest` | Visitante | simulados + ranking |
| `standard` | Aluno SanarFlix | + comparativo |
| `pro` | Aluno PRO | + caderno de erros |

- O segmento é definido no banco (`profiles.segment`). O frontend **apenas lê**.
- Hook: `useSegment()`, `useHasAccess(feature)` (em `UserContext`)
- Componente gate: `<ProGate feature="cadernoErros">` — não reimplementar

## Banco de Dados (Supabase)

**Regras críticas:**
1. **Nunca calcular score no cliente.** Sempre usar `finalize_attempt_with_results(attempt_id)` RPC.
2. **Nunca criar attempt diretamente.** Sempre usar `create_attempt_guarded(simulado_id)` RPC.
3. **Nunca salvar progresso diretamente em `attempts`.** Usar `update_attempt_progress_guarded`.
4. **Nunca salvar onboarding diretamente.** Usar `save_onboarding_guarded(specialty, institutions[])`.
5. Todas as tabelas têm RLS. Sem acesso anônimo.

**Tabelas principais:** `profiles`, `onboarding_profiles`, `simulados`, `questions`, `question_options`, `attempts`, `answers`, `attempt_question_results`, `user_performance_history`, `user_performance_summary`, `error_notebook`

**Cliente Supabase:** `import { supabase } from "@/integrations/supabase/client"`

## Status de Simulado

Derivado client-side por `deriveSimuladoStatus()` em `src/lib/simulado-helpers.ts`:

```
upcoming → available → in_progress → closed_waiting → completed
                     ↘ available_late (fora da janela, treino)
```

- `is_within_window=false` no attempt → não entra no ranking (modo treino)

## Motor de Prova

`useExamFlow` (em `src/hooks/useExamFlow.ts`) orquestra tudo:
- Init/resume de attempt
- Timer (`useExamTimer`)
- Rastreamento de saída de aba/fullscreen (`useFocusControl`)
- Atalhos de teclado (`useKeyboardShortcuts`)
- Persistência debounced + sendBeacon como fallback

`SimuladoExamPage` é apenas composição de UI. Toda lógica fica nos hooks.

## Design System

- **Fonte:** Plus Jakarta Sans
- **Cor de marca:** `wine` (hsl 345 65% 42%)
- **Tokens semânticos:** `primary`, `success`, `warning`, `info`, `destructive`, `muted`
- **Tailwind custom font sizes:** `text-kpi`, `text-display`, `text-heading-1/2/3`, `text-body`, `text-overline`, `text-caption`, `text-micro-label`
- **Dark mode:** class-based (via `next-themes`)
- **shadcn:** configurado, não gerar componentes manualmente

## Testes

- Arquivos de teste: `*.test.ts` / `*.test.tsx` em qualquer pasta dentro de `src/`
- Setup: `src/test/setup.ts`
- Testes unitários em `src/lib/` (ex: `resultHelpers.test.ts`, `simulado-helpers.test.ts`)
- Playwright: para E2E (configurado mas secundário)

## Padrão de Logging

```typescript
import { logger } from "@/lib/logger"
logger.log('[ComponentName] Mensagem')
logger.error('[ComponentName] Erro:', error)
```

Nunca usar `console.log` direto.

## Alertas / Toasts

```typescript
import { toast } from "@/hooks/use-toast"
toast({ title: "Título", description: "Descrição", variant: "destructive" })
```

Ou `sonner` via `import { toast as sonnerToast } from "sonner"` para toasts simples.
