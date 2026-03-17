# Como solucionar os 10 maiores riscos técnicos

Este documento mapeia cada risco da auditoria para uma solução concreta: status atual, passos e arquivos envolvidos. Use como playbook de implementação.

---

## Visão geral de status

| # | Risco | Status | Onde atuar |
|---|--------|--------|------------|
| 1 | RLS Supabase não auditable | **Resolvido** | docs/SUPABASE_RLS.md |
| 2 | Env não documentado | **Resolvido** | .env.example + README |
| 3 | SimuladoExamPage muito complexa | **Resolvido** | useExamFlow + página enxuta |
| 4 | Dois requests em getQuestions | **Parcial** (fluxo claro) | Opcional: RPC/join no Supabase |
| 5 | Código morto e dois cadernos | **Resolvido** | Remoção + errorNotebookReasons |
| 6 | TypeScript permissivo | **Resolvido** | noImplicitAny + noFallthroughCasesInSwitch + env tipado + `as any` removido |
| 7 | Falhas silenciosas | **Resolvido** | UserContext (profileError + toast) + useExamStorageReal (fromCache + toast) |
| 8 | Sem error boundary | **Resolvido** | ErrorBoundary.tsx + App.tsx |
| 9 | Fetches redundantes | **Resolvido** | React Query em useSimuladoDetail + useSimulados |
| 10 | Logs em produção | **Resolvido** | logger.ts condicional (DEV) em todos os arquivos sensíveis |

---

## 1. RLS Supabase não auditable

**Problema:** Não dá para garantir só pelo código que attempts, answers, profiles, error_notebook e RPC de ranking estão restritos por usuário.

**Solução (fora do repositório):**

1. **No dashboard Supabase:** Authentication → Policies (ou Table Editor → cada tabela → RLS).
2. **Tabelas a proteger:**
   - `profiles`: SELECT/UPDATE apenas onde `id = auth.uid()`.
   - `onboarding_profiles`: SELECT/UPDATE/INSERT apenas onde `user_id = auth.uid()`.
   - `attempts`: SELECT/INSERT/UPDATE apenas onde `user_id = auth.uid()`.
   - `answers`: acesso via `attempt_id` que pertence ao usuário (ou policy que junta attempts).
   - `error_notebook`: SELECT/INSERT/UPDATE/DELETE apenas onde `user_id = auth.uid()` (e soft delete com `deleted_at`).
3. **RPC `get_ranking_for_simulado`:** Deve ser `SECURITY DEFINER` e, internamente, só retornar dados que a aplicação pode ver (ex.: ranking público por simulado, sem dados sensíveis de outros usuários). Revisar a função no SQL do projeto.
4. **Documentar:** Criar `docs/SUPABASE_RLS.md` (ou seção no README) listando: tabelas com RLS ativado, resumo das políticas (quem pode ler/escrever o quê) e que a RPC de ranking é definer e o que retorna.

**Checklist:** RLS ativado em todas as tabelas acima → políticas testadas (tentar com dois usuários) → doc atualizada.

---

## 2. Env não documentado — ✅ Resolvido

- Já existe `.env.example` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- README descreve variáveis e instrui a copiar `.env.example`.
- **Manutenção:** Ao adicionar nova variável de ambiente, atualizar `.env.example` e a tabela no README.

---

## 3. SimuladoExamPage muito complexa — ✅ Resolvido

- Lógica da prova foi extraída para `src/hooks/useExamFlow.ts` (init, finalize, timer, handlers, atalhos).
- `SimuladoExamPage` só chama `useExamFlow()` e renderiza (loading, conclusão, prova, modal).
- **Manutenção:** Novas regras de prova devem ir no hook ou em helpers; a página continua só de apresentação.

---

## 4. Dois requests em getQuestions

**Status:** O fluxo já está claro (primeiro questions, depois options por ids); ainda são 2 round-trips.

**Solução para reduzir latência (opcional):**

- **Opção A – Relação no select (Supabase):**  
  Uma única chamada:  
  `supabase.from('questions').select('*, question_options(*)').eq('simulado_id', simuladoId).order('question_number')`  
  Exige que a relação `question_options` esteja definida no Supabase (foreign key). Depois, no código, mapear o resultado para o tipo `Question[]` (cada item vem com array de options).

- **Opção B – RPC:**  
  Criar uma função SQL que recebe `p_simulado_id` e retorna um JSON (ou setof) com questões e opções em uma única ida ao banco. O client chama `supabase.rpc('get_questions_with_options', { p_simulado_id: simuladoId })` e mapeia a resposta para `Question[]`.

**Arquivos:** `src/services/simuladosApi.ts` (substituir corpo de `getQuestions`); se usar RPC, criar/migrar a função no projeto Supabase.

---

## 5. Código morto e dois cadernos — ✅ Resolvido

- Removidos: `useExamStorage`, `mock-questions.ts`, `notebook-helpers.ts`, exports não usados de `mock.ts`, `generateMockRanking` em resultHelpers.
- Labels e mapeamento do Caderno de Erros centralizados em `src/lib/errorNotebookReasons.ts`; CadernoErrosPage e AddToNotebookModal usam esse módulo.
- **Manutenção:** Novos motivos (reason) do caderno: adicionar em `errorNotebookReasons.ts` (DB + local + labels).

---

## 6. TypeScript permissivo

**Problema:** `strict: false`, `strictNullChecks: false`, `noImplicitAny: false` e alguns `as any` permitem erros em runtime.

**Solução (gradual):**

1. **Tipar env (evitar any implícito em env):**  
   Em `src/vite-env.d.ts`:
   ```ts
   /// <reference types="vite/client" />
   interface ImportMetaEnv {
     readonly VITE_SUPABASE_URL: string;
     readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
     readonly VITE_SUPABASE_PROJECT_ID?: string;
   }
   interface ImportMeta {
     readonly env: ImportMetaEnv;
   }
   ```

2. **Eliminar `as any`:**  
   - `src/services/simuladosApi.ts`: no `addToErrorNotebook`, tipar o objeto de insert conforme os tipos gerados em `integrations/supabase/types.ts` (Insert<"error_notebook">) em vez de `as any`.  
   - `src/services/rankingApi.ts`: tipar o join de attempts com simulados (usar tipo do Supabase para o select com relação) em vez de `(a as any).simulados`.

3. **Habilitar strict por etapa:**  
   - Primeiro: `noImplicitAny: true` em `tsconfig.app.json` e corrigir erros arquivo a arquivo.  
   - Depois: `strictNullChecks: true` e ajustar null/undefined (opcionais, fallbacks).  
   - Por último: `strict: true` se ainda não estiver ligado.

**Arquivos:** `tsconfig.app.json`, `src/vite-env.d.ts`, `simuladosApi.ts`, `rankingApi.ts`, e qualquer arquivo que apareça com erro após ligar as flags.

---

## 7. Falhas silenciosas (UserContext, useExamStorageReal)

**Problema:** Em erro, UserContext só faz log e não informa o usuário; useExamStorageReal faz fallback para cache local sem avisar.

**Solução:**

1. **UserContext:**  
   - Adicionar estado `profileError: string | null` (ou `error: string | null`) no context.  
   - No `catch` de `fetchUserData`, além do `console.error`, fazer `setProfileError(err.message || 'Erro ao carregar perfil')`.  
   - Exportar no context e, no `AppLayout` ou em um componente global que use `useUser()`, se `profileError` existir, exibir um banner ou toast (“Não foi possível carregar seu perfil. Tente recarregar.”) e opção de retry (ex.: chamar `refreshProfile()`).

2. **useExamStorageReal:**  
   - No `loadState`, quando cair no fallback (catch e `loadLocalState()`), retornar o estado local mas sinalizar que veio do cache (ex.: retornar `{ state, fromCache: true }` ou um callback `onFallbackToCache()`).  
   - Na página/hook que usa (ex.: useExamFlow), ao detectar `fromCache: true`, mostrar um toast: “Você está vendo dados salvos localmente. Algumas respostas podem não estar sincronizadas.” para o usuário ter noção.

**Arquivos:** `src/contexts/UserContext.tsx`, `src/hooks/useExamStorageReal.ts`, `src/hooks/useExamFlow.ts` (ou SimuladoExamPage se não usar fromCache no hook), e um componente de banner/toast global se ainda não houver.

---

## 8. Sem error boundary

**Problema:** Qualquer erro não tratado em componente derruba a árvore inteira; usuário vê tela em branco.

**Solução:**

1. **Criar um Error Boundary em React:**  
   - Criar `src/components/ErrorBoundary.tsx`: class component que implementa `componentDidCatch` e `getDerivedStateFromError`, guarda `hasError` e `error` no state e, em caso de erro, renderiza uma tela simples (“Algo deu errado. Recarregue a página.” + botão “Recarregar” que chama `window.location.reload()` ou navega para `/`).  
   - (React 18: pode usar apenas class component para error boundary; hooks não cobrem `componentDidCatch`.)

2. **Envolver a árvore no App:**  
   - Em `App.tsx`, envolver o conteúdo principal (por exemplo, dentro de `BrowserRouter`) com `<ErrorBoundary>`. Assim, qualquer erro de renderização em rotas protegidas ou públicas cai no boundary e o usuário vê a mensagem em vez de tela branca.

3. **Opcional:** Um segundo boundary mais interno (ex.: só em volta das rotas protegidas) para mensagens diferentes (ex.: “Erro na aplicação” vs “Erro ao carregar esta página”).

**Arquivos:** novo `src/components/ErrorBoundary.tsx`, `src/App.tsx`.

---

## 9. Fetches redundantes (useSimuladoDetail em várias páginas)

**Problema:** Várias páginas chamam `useSimuladoDetail(id)` para o mesmo `id`; cada uma refaz a requisição ao montar.

**Solução:** Usar React Query para cache por `simuladoId`:

1. **Criar um hook que usa useQuery:**  
   - Ex.: `useSimuladoDetailQuery(simuladoId: string | undefined)`.  
   - Dentro: `useQuery({ queryKey: ['simulado', simuladoId], queryFn: () => fetchSimuladoWithQuestions(simuladoId), enabled: !!simuladoId, staleTime: 5 * 60 * 1000 })`.  
   - A função `fetchSimuladoWithQuestions` pode encapsular a lógica atual (getSimulado + getQuestions + getAttempt para o user) ou você pode manter `simuladosApi` e só orquestrar no queryFn.

2. **Substituir useSimuladoDetail:**  
   - Onde hoje se usa `useSimuladoDetail(id)` (SimuladoDetailPage, SimuladoExamPage, ResultadoPage, CorrecaoPage, etc.), passar a usar `useSimuladoDetailQuery(id)`.  
   - Assim, ao navegar entre detalhe → prova → resultado para o mesmo simulado, os dados vêm do cache (e opcionalmente revalidam em background).

3. **Lista de simulados:**  
   - Se quiser cache também para a lista: criar `useSimuladosQuery()` com `useQuery` e chave tipo `['simulados']`, e substituir `useSimulados()` onde fizer sentido (ex.: Index e SimuladosPage passam a usar o mesmo cache).

**Arquivos:** novo hook (ex.: `src/hooks/useSimuladoDetailQuery.ts` ou refatorar `useSimuladoDetail` para usar useQuery por dentro), `src/hooks/useSimulados.ts` (ou novo useSimuladosQuery), e páginas que usam esses hooks. React Query já está no projeto (`@tanstack/react-query`).

---

## 10. Logs com dados de usuário em produção

**Problema:** `console.log` com email, user id ou fluxos de auth podem vazar em ferramentas de suporte ou console do navegador.

**Solução:**

1. **Logger condicional:**  
   - Criar `src/lib/logger.ts`:  
     - `const isDev = import.meta.env.DEV;`  
     - Exportar `logger = { log: (...args) => isDev && console.log(...args), warn: (...args) => isDev && console.warn(...args), error: (...args) => console.error(...args) }` (ou manter `error` sempre para falhas reais, mas sem dados sensíveis).  
   - Em produção (`import.meta.env.PROD`), não logar nada (ou só enviar para um serviço de monitoramento sem PII).

2. **Substituir console em pontos sensíveis:**  
   - Trocar `console.log` / `console.warn` por `logger.log` / `logger.warn` em: AuthContext, UserContext, LoginPage, useExamStorageReal, useSimuladoDetail, simuladosApi, rankingApi, etc.  
   - Manter `console.error` apenas onde for estritamente necessário e, se possível, sem email/user id (ou usar logger.error que em prod pode ser um no-op ou enviar só mensagem genérica).

**Arquivos:** novo `src/lib/logger.ts`, e todos os arquivos que hoje usam `console.log`/`console.warn` em fluxos de auth ou dados de usuário (busca por `console.` no `src`).

---

## Ordem sugerida de implementação

1. **Risco 8 (Error boundary)** — rápido e reduz tela branca.  
2. **Risco 7 (Falhas silenciosas)** — melhor UX em erro de perfil e prova.  
3. **Risco 1 (RLS)** — revisão e documentação no Supabase.  
4. **Risco 10 (Logs)** — logger + substituição de console.  
5. **Risco 6 (TypeScript)** — env + remoção de any + strict gradual.  
6. **Risco 9 (Cache React Query)** — mais trabalho, mas melhora performance.  
7. **Risco 4 (getQuestions em 1 request)** — opcional; fazer se quiser menos latência na abertura da prova.

Os itens já marcados como resolvidos (2, 3, 5) só precisam de manutenção conforme descrito acima.
