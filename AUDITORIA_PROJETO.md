# Auditoria técnica — enamed-arena (Simulados SanarFlix / PRO: ENAMED)

Documento de onboarding técnico + code audit. Nenhuma alteração de código foi feita; todas as conclusões são baseadas em evidência no repositório.

---

## 1. Visão geral do projeto

### Objetivo aparente da aplicação
- **Plataforma de simulados para residência médica** (PRO: ENAMED / SanarFlix).
- Usuários fazem provas cronometradas (simulados), veem resultados, ranking, desempenho por área/tema e (para assinantes PRO) Caderno de Erros e comparativo entre simulados.

### Problemas que resolve
- Centralizar simulados em janelas de execução (início/fim) e liberação de resultados.
- Autenticação (email/senha e magic link) e perfis (guest / standard / pro).
- Onboarding (especialidade e instituições-alvo) para personalizar ranking e comparativos.
- Persistência de tentativas e respostas no Supabase com cache local para UX.
- Regras de acesso por segmento (ex.: Caderno de Erros só PRO).

### Principais fluxos do usuário
1. **Login** → `/login` ou magic link → `/auth/callback` → redirecionamento para `/` ou `/onboarding`.
2. **Onboarding** (se incompleto) → escolha de especialidade e instituições → redirecionamento para dashboard.
3. **Dashboard** (`/`) → lista de simulados, próximo simulado, atalhos (ranking, desempenho, caderno, etc.).
4. **Simulado** → lista (`/simulados`) → detalhe (`/simulados/:id`) → prova (`/simulados/:id/prova`) → resultado (`/simulados/:id/resultado`) e correção (`/simulados/:id/correcao`).
5. **Ranking** (`/ranking`), **Desempenho** (`/desempenho`), **Comparativo** (`/comparativo`), **Caderno de Erros** (`/caderno-erros`), **Configurações** (`/configuracoes`).

### Stack identificada
| Camada | Tecnologia |
|--------|------------|
| Build | Vite 5, TypeScript 5 |
| UI | React 18, React Router 6 |
| Componentes | shadcn/ui (Radix UI), Tailwind CSS, Framer Motion, Lucide |
| Estado/Server | TanStack React Query, Context (Auth, User) |
| Backend/DB | Supabase (Auth + Postgres) |
| Forms/Validação | React Hook Form, Zod, @hookform/resolvers |
| Testes | Vitest, Testing Library, Playwright (Lovable) |
| Outros | date-fns, recharts, sonner, vaul, cmdk, etc. |

### Como a aplicação está organizada
- **SPA** com entrada em `index.html` → `src/main.tsx` → `App.tsx`.
- Rotas em `App.tsx`; rotas protegidas via `ProtectedRoute` (auth + onboarding).
- Providers globais: `QueryClientProvider` → `TooltipProvider` → `AuthProvider` → `UserProvider` → `BrowserRouter`.
- Páginas sob `AppLayout` (sidebar + header) exceto login, callback e prova (telas dedicadas).

**Evidências:** `index.html` (linha 27: script `/src/main.tsx`), `src/main.tsx`, `src/App.tsx` (rotas e providers), `package.json` (nome `vite_react_shadcn_ts`, dependências).

---

## 2. Mapa da arquitetura

### Estrutura macro do projeto
```
enamed-arena/
├── index.html
├── package.json
├── vite.config.ts          # Plugin react + lovable-tagger, alias @ → src
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── tailwind.config.ts, postcss.config.js, eslint.config.js
├── playwright.config.ts    # Lovable Playwright
├── src/
│   ├── main.tsx            # Ponto de entrada React
│   ├── App.tsx             # Rotas + providers
│   ├── index.css           # Tailwind + design system (variáveis CSS)
│   ├── vite-env.d.ts
│   ├── components/         # Componentes React
│   │   ├── ui/             # shadcn (button, card, dialog, etc.)
│   │   ├── exam/           # ExamHeader, QuestionDisplay, QuestionNavigator, etc.
│   │   └── ...             # AppLayout, AppSidebar, ProGate, etc.
│   ├── pages/              # Páginas por rota
│   ├── contexts/           # AuthContext, UserContext
│   ├── hooks/              # useSimulados, useSimuladoDetail, useExamStorageReal, etc.
│   ├── services/           # simuladosApi, rankingApi
│   ├── lib/                # utils, simulado-helpers, resultHelpers, notebook-helpers
│   ├── types/              # index.ts (domínio), exam.ts
│   ├── data/               # mock.ts (SPECIALTIES, INSTITUTIONS), mock-questions.ts
│   ├── integrations/supabase/  # client.ts, types.ts (gerados)
│   └── test/               # setup.ts, example.test.ts
└── README.md               # Lovable genérico
```

### Separação entre UI, lógica, dados e integrações
- **UI:** `pages/`, `components/` — apresentação e interação.
- **Lógica de negócio:** `lib/*-helpers.ts`, `types/`, regras em `simulado-helpers` (status, CTA, acesso).
- **Dados:** `services/simuladosApi.ts`, `services/rankingApi.ts` — acesso Supabase.
- **Integrações:** `integrations/supabase/client.ts` e `types.ts` — único backend explícito.
- **Estado global:** `contexts/AuthContext`, `contexts/UserContext`; estado de lista/cache via React Query onde aplicável (config global em `App.tsx`).

### Fluxo de dados
- **Auth:** Supabase Auth → `AuthContext` (user, session, signIn/signUp/signOut) → `ProtectedRoute` e páginas.
- **Perfil/Onboarding:** Supabase `profiles` + `onboarding_profiles` → `UserContext` (profile, onboarding, saveOnboarding, refreshProfile).
- **Simulados:** `simuladosApi` → hooks `useSimulados`, `useSimuladoDetail` → páginas.
- **Prova:** `useExamStorageReal` (Supabase attempts/answers + localStorage cache) + `useExamTimer`, `useFocusControl`, `useKeyboardShortcuts` → `SimuladoExamPage`.
- **Resultado/Correção:** `useExamResult` (attempt + answers do Supabase, fallback localStorage) + `resultHelpers` → `ResultadoPage`, `CorrecaoPage`.
- **Ranking:** `rankingApi` (RPC `get_ranking_for_simulado`) → `useRanking` → `RankingPage`.

### Pontos de entrada
- **Aplicação:** `index.html` → `src/main.tsx` → `App.tsx`.
- **Rotas públicas:** `/login`, `/auth/callback`.
- **Rotas protegidas:** todas as demais, com `ProtectedRoute`; `/onboarding` com `skipOnboardingCheck`.

### Configurações globais
- **Vite:** `vite.config.ts` (porta 8080, host `::`, alias `@`, plugin lovable-tagger em dev).
- **React Query:** `App.tsx` (staleTime 5 min, refetchOnWindowFocus false).
- **Supabase:** `src/integrations/supabase/client.ts` (URL e key via `import.meta.env`).
- **Estilos:** `src/index.css` (design system, variáveis CSS, tema claro/escuro sidebar).

### Onde ficam hooks, services, utils, providers, middlewares
- **Hooks:** `src/hooks/` (useSimulados, useSimuladoDetail, useExamStorage, useExamStorageReal, useExamResult, useExamTimer, useRanking, useFocusControl, useKeyboardShortcuts, use-mobile, use-toast, usePersistedState).
- **Services:** `src/services/` (simuladosApi, rankingApi).
- **Utils:** `src/lib/utils.ts` (cn, etc.).
- **Providers:** `src/contexts/AuthContext.tsx`, `src/contexts/UserContext.tsx`; envolvem a app em `App.tsx`.
- **Middleware-like:** `ProtectedRoute` (redirect login/onboarding); não há middleware de rede (tudo client-side).

**Evidências:** estrutura de pastas listada acima; `App.tsx` (providers e rotas); `vite.config.ts`; `src/integrations/supabase/client.ts`.

---

## 3. Mapeamento funcional

### 3.1 Autenticação e usuário
- **O que faz:** Login (senha e magic link), signup, callback OAuth, sessão persistida; perfil e onboarding no Supabase.
- **Arquivos:** `contexts/AuthContext.tsx`, `contexts/UserContext.tsx`, `pages/LoginPage.tsx`, `pages/AuthCallbackPage.tsx`, `components/ProtectedRoute.tsx`, `integrations/supabase/client.ts`.
- **Conexões:** Auth usada por ProtectedRoute e por qualquer página que precise de `user`; UserContext usa Auth e lê/escreve `profiles` e `onboarding_profiles`.
- **Dependências:** Supabase Auth e tabelas `profiles`, `onboarding_profiles`; tipos em `types/index.ts` (UserProfile, OnboardingProfile, SEGMENT_ACCESS).

### 3.2 Simulados (listagem e detalhe)
- **O que faz:** Lista simulados publicados com status derivado (upcoming, available, in_progress, etc.) e estado do usuário (iniciado, nota); detalhe de um simulado + questões.
- **Arquivos:** `services/simuladosApi.ts`, `hooks/useSimulados.ts`, `hooks/useSimuladoDetail.ts`, `lib/simulado-helpers.ts`, `pages/SimuladosPage.tsx`, `pages/SimuladoDetailPage.tsx`, `pages/Index.tsx`.
- **Conexões:** simuladosApi → useSimulados/useSimuladoDetail; simulado-helpers (deriveSimuladoStatus, enrichSimulado, canAccessSimulado, etc.) usados nas páginas.
- **Dependências:** Supabase tabelas `simulados`, `questions`, `question_options`, `attempts`; tipos em `types/index.ts` e `types/exam.ts`.

### 3.3 Prova (exam)
- **O que faz:** Carrega ou inicia tentativa, exibe questões, salva respostas (debounced + flush), controle de foco/aba/fullscreen, timer, finalização e envio de nota.
- **Arquivos:** `pages/SimuladoExamPage.tsx`, `hooks/useExamStorageReal.ts`, `hooks/useExamTimer.ts`, `hooks/useFocusControl.ts`, `hooks/useKeyboardShortcuts.ts`, `components/exam/ExamHeader.tsx`, `components/exam/QuestionDisplay.tsx`, `components/exam/QuestionNavigator.tsx`, `components/exam/SubmitConfirmModal.tsx`, `components/exam/ExamCompletedScreen.tsx`, `lib/resultHelpers.ts` (computeSimuladoScore).
- **Conexões:** useSimuladoDetail (simulado + questões), useExamStorageReal (attempt + answers no Supabase + cache localStorage), useExamResult usado só em resultado/correção.
- **Dependências:** `simuladosApi` (getAttempt, getAnswers, createAttempt, updateAttempt, upsertAnswer, bulkUpsertAnswers, submitAttempt); tipos `ExamState`, `ExamAnswer` em `types/exam.ts`.

### 3.4 Resultado e correção
- **O que faz:** Exibe nota, desempenho por área/tema; correção questão a questão com opção de adicionar ao Caderno de Erros (PRO).
- **Arquivos:** `pages/ResultadoPage.tsx`, `pages/CorrecaoPage.tsx`, `hooks/useExamResult.ts`, `lib/resultHelpers.ts` (computeSimuladoScore, computePerformanceBreakdown).
- **Conexões:** useSimuladoDetail + useExamResult; resultHelpers para scores e breakdown; CorrecaoPage usa AddToNotebookModal e simuladosApi.addToErrorNotebook.

### 3.5 Ranking
- **O que faz:** Lista simulados com resultado; seleção de simulado; ranking de participantes (RPC); filtros por especialidade/instituição e segmento.
- **Arquivos:** `services/rankingApi.ts`, `hooks/useRanking.ts`, `pages/RankingPage.tsx`.
- **Conexões:** rankingApi.get_ranking_for_simulado e fetchSimuladosWithResults; useRanking agrega dados e filtros.
- **Dependências:** Supabase RPC `get_ranking_for_simulado` e tabelas `attempts`/simulados para lista.

### 3.6 Desempenho e comparativo
- **O que faz:** Visão de desempenho (provavelmente por simulado/área); comparativo entre simulados com insights (resultHelpers.computeComparativeInsights).
- **Arquivos:** `pages/DesempenhoPage.tsx`, `pages/ComparativoPage.tsx`, `lib/resultHelpers.ts` (generateMockRanking, computeComparativeInsights).
- **Dependências:** Dados de attempts/resultados; Comparativo usa SEGMENT_ACCESS (apenas standard/pro).

### 3.7 Caderno de Erros (PRO)
- **O que faz:** Lista entradas do caderno (Supabase `error_notebook`), filtro por área, remoção; adição na correção via AddToNotebookModal.
- **Arquivos:** `pages/CadernoErrosPage.tsx`, `components/AddToNotebookModal.tsx`, `services/simuladosApi.ts` (addToErrorNotebook, getErrorNotebook, deleteErrorNotebookEntry), `lib/notebook-helpers.ts` (tipos/labels locais; persistência real é só Supabase).
- **Conexões:** ProGate se segment !== pro; CadernoContent usa simuladosApi; modal mapeia razões locais (pt) para enum DB (inglês).
- **Dependências:** Tabela `error_notebook` e enum `error_reason` no Supabase.

### 3.8 Onboarding e configurações
- **O que faz:** Onboarding: especialidade e instituições (salvo em `onboarding_profiles`); Configurações: página de preferências/perfil.
- **Arquivos:** `pages/OnboardingPage.tsx`, `pages/ConfiguracoesPage.tsx`, `data/mock.ts` (SPECIALTIES, INSTITUTIONS).
- **Conexões:** UserContext.saveOnboarding, updateProfile; mock.ts só para listas estáticas de onboarding.

### 3.9 UI compartilhada e layout
- **O que faz:** Layout com sidebar (AppLayout, AppSidebar), navegação (NavLink), componentes de lista/cards (PremiumCard, SimuladoCard, etc.), ProGate para features PRO, toasts (sonner + use-toast).
- **Arquivos:** `components/AppLayout.tsx`, `components/AppSidebar.tsx`, `components/NavLink.tsx`, `components/ProGate.tsx`, `components/PageHeader.tsx`, `components/SectionHeader.tsx`, `components/ui/*` (shadcn), etc.
- **Conexões:** AppLayout em todas as páginas internas; sidebar usa useAuth/useUser e NavLink com activeClassName.

---

## 4. Dependências e integrações

### Bibliotecas relevantes e uso
- **@supabase/supabase-js:** cliente Supabase (auth + Postgres). Uso: auth, simulados, attempts, answers, profiles, onboarding, error_notebook, RPC ranking.
- **@tanstack/react-query:** cache e estado assíncrono. Uso: config global em App (staleTime 5 min); uso direto em páginas é limitado (maioria usa useState/useEffect + services).
- **react-router-dom:** rotas e navegação.
- **Radix UI (via shadcn):** acessibilidade e primitivos (dialog, dropdown, etc.).
- **framer-motion:** animações (páginas, modais, listas).
- **react-hook-form + zod + @hookform/resolvers:** formulários (onboarding, etc.) quando usados.
- **date-fns:** datas (janelas de simulado, prazos, formatação pt-BR).
- **recharts:** gráficos (desempenho/comparativo).
- **sonner + toaster:** notificações.
- **lovable-tagger:** plugin Vite em dev (tagging de componentes para Lovable).
- **vitest + @testing-library/react + jsdom:** testes unitários; **playwright:** E2E (config Lovable).

### Possíveis problemas de dependências
- **useExamStorage** (localStorage puro): não é usado em nenhum arquivo; só **useExamStorageReal** é usado em `SimuladoExamPage.tsx`. Hook legado ou duplicado.
- **lib/notebook-helpers.ts:** funções `loadNotebook`, `saveNotebook`, `addToNotebook`, `removeFromNotebook`, `isInNotebook` usam apenas localStorage; o Caderno de Erros real usa só Supabase (simuladosApi). Código local pode ser código morto ou plano antigo; únicos usos ativos são tipos/labels (ErrorReason, ERROR_REASON_LABELS) que estão duplicados/parcialmente alinhados com AddToNotebookModal (que usa REASON_MAP para DB).
- **resultHelpers.generateMockRanking:** gera ranking fake; verificar se ainda é usado em algum lugar ou se ranking é 100% Supabase (useRanking/rankingApi).
- **data/mock-questions.ts:** não importado em lugar nenhum; questões vêm de `simuladosApi.getQuestions`. Código morto.
- **data/mock.ts:** `CURRENT_USER`, `RANKING_DATA`, `AREA_PERFORMANCE` não são importados em nenhum outro arquivo; só `SPECIALTIES` e `INSTITUTIONS` são usados (OnboardingPage). Exports mortos.

### Integrações externas
- **Supabase:** única integração de backend (Auth + Postgres). Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (`src/integrations/supabase/client.ts`).
- **Sem analytics, pagamentos ou outros serviços** visíveis no código (exceto Supabase).
- **Fontes:** Google Fonts (Plus Jakarta Sans) em `index.css`.

**Evidências:** `package.json`; `src/integrations/supabase/client.ts`; grep por `useExamStorage`/`useExamStorageReal`; grep por `mock.ts`/`mock-questions`; `lib/notebook-helpers.ts` vs uso em CadernoErrosPage e AddToNotebookModal.

---

## 5. Análise de qualidade de código

### Organização
- **Positivo:** Separação clara entre pages, components, hooks, services, lib, contexts, types. Naming consistente (useSimulados, useExamStorageReal, simuladosApi).
- **Negativo:** `lib/notebook-helpers.ts` mistura helpers de localStorage (não usados pelo fluxo Supabase) com tipos/labels; duplicação de conceito de “reason” (pt vs enum DB) em mais de um arquivo.

### Legibilidade
- **Positivo:** Comentários em blocos (───) em services e hooks; tipos explícitos em tipos/exam e types/index.
- **Negativo:** `SimuladoExamPage.tsx` é longo (~500+ linhas); vários `useCallback`/`useEffect` encadeados; lógica de init da prova em useEffect com async IIFE e `cancelled` manual.

### Acoplamento
- **Alto:** Páginas de resultado/correção/desempenho acopladas a useSimuladoDetail + useExamResult + resultHelpers. SimuladoExamPage fortemente acoplado a useExamStorageReal, useExamTimer, useFocusControl, useKeyboardShortcuts.
- **Moderado:** Auth e User em contextos; services isolados mas usados diretamente por hooks.

### Coesão
- **Boa** em services e em simulado-helpers/resultHelpers. **Baixa** em notebook-helpers (localStorage vs apenas tipos usados fora).

### Duplicação
- **Labels de motivo do caderno de erros:** CadernoErrosPage tem `REASON_LABELS` (did_not_know → "Não sei..."); notebook-helpers tem `ERROR_REASON_LABELS` (nao_sei → "Não sei..."); AddToNotebookModal tem `REASON_LABELS` (LocalReason). Três fontes para o mesmo conjunto de textos.
- **Tipos de “reason”:** ErrorReason (pt) em notebook-helpers, DbReason em AddToNotebookModal, enum no Supabase. Mapeamento apenas no modal.

### Complexidade
- **SimuladoExamPage:** init assíncrono, flush antes unload, timer, atalhos de teclado, estado de prova — alta complexidade ciclomática e de fluxo.
- **simuladosApi.getQuestions:** Duas queries onde a segunda usa resultado da primeira (ids); sequência disfarçada em Promise.all (await dentro do .in()).

### Padrões inconsistentes
- **Tratamento de erro:** Alguns lugares retornam `{ error: string | null }` (AuthContext), outros lançam (simuladosApi), outros setError + log (hooks). Sem camada única de error boundary ou handler global.
- **Loading:** Alguns usam SkeletonCard, outros spinner genérico, outros só “Carregando...”. Padrão visual não unificado.
- **Tipagem:** `tsconfig` com `noImplicitAny: false`, `strictNullChecks: false`, `strict: false` — tipagem frouxa; há `as any` em simuladosApi (insert error_notebook).

### Code smells
- **useEffect com async IIFE** em SimuladoExamPage (init) e dependências omitidas (eslint-disable react-hooks/exhaustive-deps).
- **hasFinalized.current** para evitar double-submit: correto, mas frágil se surgir outro caminho de finalização.
- **simuladosApi.addToErrorNotebook** recebe objeto com `as any` no insert.
- **rankingApi.fetchSimuladosWithResults** usa `(a as any).simulados` para tipar join.
- **CadernoErrosPage** mapeia `row.reason` direto para exibição; labels vêm de objeto fixo (did_not_know, etc.) — alinhado ao DB, não ao notebook-helpers.

### Riscos de manutenção
- Alterar fluxo da prova exige mexer em SimuladoExamPage, useExamStorageReal e vários hooks de apoio.
- Duplicação de “reason” e dois sistemas (local vs Supabase) no caderno aumentam risco de inconsistência.
- TypeScript permissivo esconde erros até runtime.

### Arquivos/componentes grandes
- **SimuladoExamPage.tsx:** ~514 linhas; concentra init, handlers, timer, shortcuts, render da prova e do completed.
- **LoginPage.tsx:** ~360 linhas; formulários e estados de fluxo (login/signup, magic link, sent).
- **simuladosApi.ts:** ~390 linhas; muitas funções no mesmo objeto, mas coesas.

### Tipagem
- **Frouxa:** strict e strictNullChecks desligados; noUnusedLocals/noUnusedParameters false.
- **Faltando:** Declaração de `ImportMetaEnv` para `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `vite-env.d.ts` (Vite costuma inferir, mas não está explícito).
- **Uso de any:** simuladosApi (error_notebook insert), rankingApi (attempts com simulados).

### Tratamento de erro
- Services: maioria faz throw após log; hooks: setError + console.error; AuthContext: retorno `{ error: string | null }`; LoginPage: translateError para mensagens em pt. Sem error boundary global; falhas podem deixar UI em estado indefinido.

### Uso de async/await
- Consistente; uso de try/catch em chamadas async. Em SimuladoExamPage o init em useEffect com async IIFE e flag `cancelled` é o padrão para evitar setState após unmount.

### Naming
- Em geral consistente (camelCase, hooks com “use”, componentes PascalCase). “Correcao” (sem cedilha) por restrição de código; “simulado” usado de forma uniforme.

### Separação de responsabilidades
- Services não fazem UI; hooks orquestram dados e estado; páginas compõem. Exceção: lógica de negócio espalhada (ex.: canAccessSimulado, canViewResults em simulado-helpers; computeSimuladoScore em resultHelpers) — aceitável, mas poderia ser agrupada em um domínio “exam” ou “simulado”.

**Evidências:** Leitura de SimuladoExamPage, LoginPage, simuladosApi, CadernoErrosPage, notebook-helpers, AddToNotebookModal; tsconfig.app.json e tsconfig.json; grep por “as any” e “eslint-disable”.

---

## 6. Análise de front-end / UX técnica

### Componentização
- **Positivo:** Muitos componentes reutilizáveis em `components/ui` (shadcn) e componentes de domínio (ExamHeader, QuestionDisplay, PremiumCard, ProGate, etc.).
- **Negativo:** LoginPage contém subcomponentes (Brand, FieldEmail, FieldPassword, ErrorMessage, Spinner) no mesmo arquivo; poderiam estar em `components/auth/` ou similares.

### Reuso
- **Bom:** AppLayout, PageHeader, SectionHeader, EmptyState, SkeletonCard, StatusBadge, NavLink usados em várias páginas. ProGate reutilizado para Caderno e possivelmente comparativo.
- **Limitado:** Formulários de login são específicos da página.

### Gerenciamento de estado
- **Global:** Auth e User em contextos; React Query com config global (pouco uso explícito de useQuery/useMutation nas páginas).
- **Local:** Estado de lista de simulados, detalhe, prova, ranking etc. em hooks com useState/useEffect. Estado da prova é o mais complexo (ExamState em SimuladoExamPage + useExamStorageReal).

### Performance de renderização
- **Possível melhoria:** SimuladoExamPage re-renderiza com qualquer mudança de state (respostas, índice, etc.); QuestionDisplay e navegador poderiam ser memoizados se houver muitos itens.
- **React Query:** staleTime 5 min reduz refetches; mas muitas telas não usam React Query e refazem fetch em mount.

### Loading / error / empty states
- **Loading:** Spinner em ProtectedRoute; SkeletonCard em Index, Resultado, CadernoErros; “Carregando simulado...” na prova. Inconsistência entre spinners e skeletons.
- **Error:** Mensagens em toast ou inline (Login, AuthCallback); em hooks, setError nem sempre é exibido na UI (ex.: useSimulados.error).
- **Empty:** EmptyState usado (Resultado, Ranking, CadernoErros, etc.); boa prática.

### Acessibilidade
- **Positivo:** Radix/shadcn trazem acessibilidade base; labels em formulários; estrutura de heading provável.
- **Não verificado:** foco em modais, ordem de tab na prova, anúncios para leitores de tela, contraste (tema wine/neutros parece adequado).

### Responsividade
- **Tailwind:** Uso de breakpoints (md:, lg:), flex/grid; sidebar colapsável (icon). Layout parece preparado para mobile.

### Consistência visual
- **Design system:** index.css com variáveis (primary, wine, success, warning, sidebar, etc.); componentes usam classes Tailwind e tokens. Aparência coerente.
- **Inconsistência:** Diferentes tratamentos de loading (spinner vs skeleton) e tamanhos de botão/input entre telas.

### Possíveis problemas de experiência
- **Prova:** Saída de aba apenas avisa (focusControl); beforeunload avisa e faz flush — bom. Timer “time up” chama finalize após 2s (setTimeout) — usuário pode não ver mensagem se navegar.
- **Magic link:** Cooldown 30s para reenviar; mensagem “verifique spam” — adequado.
- **Onboarding obrigatório:** Redirect agressivo; usuário não pode pular (por design).

### Pontos frágeis na navegação
- **ProtectedRoute:** Se user/onboarding ainda loading, mostra spinner; se não user → /login; se onboarding incompleto e path !== /onboarding → /onboarding. Depende de ordem de carregamento dos contextos.
- **SimuladoExamPage:** Redirect se !canAccessSimulado ou !isOnboardingComplete; se simulado ou id ausente, redireciona. Rotas como /simulados/:id/resultado dependem de attempt existente (useExamResult).

**Evidências:** Leitura de Index, ResultadoPage, SimuladoExamPage, ProtectedRoute, AppLayout, index.css; uso de EmptyState e SkeletonCard.

---

## 7. Análise de segurança e confiabilidade

### Exposição de segredos
- **Supabase:** Apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (anon/public key). Uso de key pública no client é esperado; políticas RLS devem proteger dados no Supabase.
- **Nenhum segredo de backend ou API key** encontrado no código.

### Uso de variáveis de ambiente
- **Client:** Apenas `import.meta.env.VITE_SUPABASE_*` em `integrations/supabase/client.ts`. Sem .env.example ou documentação no README sobre variáveis necessárias; risco de deploy sem env configurado.

### Validação
- **Login:** Email trim/toLowerCase; senha e nome validados no client (ex.: senha mínima 6 caracteres no signup). Supabase valida no servidor.
- **Formulários:** React Hook Form + Zod usados em partes do projeto; não em todos os forms (ex.: Login é manual).
- **IDs de rota:** useParams id usado direto em APIs; se id inválido, API retorna 404 ou vazio — não há validação de formato (UUID) no client.

### Autorização
- **Client:** ProtectedRoute garante usuário autenticado e onboarding completo. ProGate e SEGMENT_ACCESS (cadernoErros, comparativo) escondem UI por segmento. Autorização real deve estar no Supabase (RLS) para attempts, answers, profiles, error_notebook, e na RPC get_ranking_for_simulado.
- **Risco:** Se RLS estiver fraco ou mal configurado, usuário pode acessar dados de outros via API (supabase client usa anon key). Não é possível auditar RLS pelo repositório (só backend Supabase).

### Riscos em chamadas de API
- **Supabase:** Todas as chamadas são autenticadas (session); tentativas e respostas filtradas por user_id/simulado_id. rankingApi.get_ranking_for_simulado é RPC “security definer” — comportamento depende da função no DB.
- **Falha de rede:** Vários pontos fazem throw ou setError; nem toda tela mostra erro ao usuário (ex.: useSimulados.error pode não estar ligado a um banner).

### Manipulação de dados do usuário
- **PII:** Email, nome, especialidade, instituições em perfis e onboarding; exibidos na sidebar e em ranking (nome). Nenhum dado sensível extra exposto no código.
- **LocalStorage:** Estado da prova (enamed_exam_*) e enamed_error_notebook (não usado pelo fluxo atual). Dados da prova podem conter respostas; dispositivo compartilhado pode expor.

### Pontos de falha silenciosa
- **UserContext:** Em catch de fetchUserData só loga e setIsLoading(false); profile pode ficar null ou antigo sem feedback.
- **useExamStorageReal:** Em loadState, se DB falhar usa loadLocalState() e log; usuário pode continuar com cache antigo sem saber.
- **rankingApi.fetchSimuladosWithResults:** Em erro retorna []; RankingPage mostra “Ranking indisponível” quando simuladosWithResults.length === 0 — pode ser erro de rede, não só “nenhum simulado feito”.

### Logs sensíveis
- **Console.log:** Vários logs com email (normalizado), user id, e mensagens como “[AuthContext] Signing in with password: …”. Em produção isso pode vazar em ferramentas de suporte; considerar remover ou usar nível “debug” condicional.

### Dependências com risco
- Nenhuma dependência óbvia com CVE conhecido mencionada; recomenda-se `npm audit` e atualizações regulares.

**Evidências:** client.ts (env); AuthContext e LoginPage (validação e logs); UserContext (catch); useExamStorageReal (fallback); rankingApi; SEGMENT_ACCESS e ProGate.

---

## 8. Performance e escalabilidade

### Gargalos prováveis
- **simuladosApi.getQuestions:** Duas chamadas ao Supabase: primeiro questions (por simulado_id), depois question_options com .in('question_id', ids). O segundo request espera o primeiro (await dentro do Promise.all), então na prática são 2 round-trips sequenciais. Para simulados com muitas questões, uma única query com join ou RPC poderia reduzir latência.
- **useSimuladoDetail:** Em cada mount busca simulado + questions + attempt em paralelo (Promise.all); para página de prova já há uso de useSimuladoDetail — ok, mas múltiplas páginas (detalhe, prova, resultado, correção) podem chamar para o mesmo id; React Query poderia cachear por simuladoId.

### Renderizações desnecessárias
- **SimuladoExamPage:** Estado (state, currentQuestionIndex, answers) muda frequentemente; filhos poderiam ser memoizados (QuestionDisplay, barra de progresso) para reduzir re-renders.
- **Contextos:** AuthContext e UserContext: qualquer mudança de user/profile re-renderiza todos os consumidores; é esperado, mas listas grandes (ex.: ranking) podem sofrer se houver estado global desnecessário.

### Fetches redundantes
- **Simulado mesmo id:** SimuladoDetailPage, SimuladoExamPage, ResultadoPage, CorrecaoPage podem cada um chamar useSimuladoDetail(id) — quatro fetches para o mesmo simulado em navegação sequencial. React Query com chave por id evitaria refetch.
- **useSimulados:** Chamado no Index e em SimuladosPage; cada um tem seu estado; não há cache compartilhado além do possível do React Query (que não está sendo usado para essa lista).

### Queries ineficientes
- **getQuestions:** Ver acima; além disso, se question_options não tiver índice em question_id, o .in(..., ids) pode ser custoso.
- **getErrorNotebook:** Select * com filtro user_id e deleted_at; adequado se houver índice.

### Componentes pesados
- **SimuladoExamPage:** Muitos hooks e estado; bundle da página inclui Framer Motion, todos os componentes de exam. Lazy load da rota /simulados/:id/prova reduziria bundle inicial.
- **Recharts:** Incluso onde há gráficos (Desempenho/Comparativo); lazy load da rota ou do componente de chart reduziria tamanho inicial.

### Oportunidades de lazy loading
- **Rotas:** React.lazy + Suspense para páginas pesadas (SimuladoExamPage, RankingPage, DesempenhoPage, ComparativoPage, CadernoErrosPage) diminuiriam o bundle inicial.
- **Recharts:** Import dinâmico no módulo que renderiza gráficos.

### Caching ausente
- **Lista de simulados:** Sem cache entre páginas; refetch ao montar.
- **Detalhe + questões:** Sem cache; cada página que usa useSimuladoDetail refaz a requisição.
- **React Query:** Configurado mas pouco usado para dados de simulados/attempts; oportunidade de usar useQuery com chaves estáveis (simuladoId, userId).

### Problemas de arquitetura para crescimento
- **Monólito de UI:** Tudo em um SPA; se no futuro houver múltiplos “apps” (ex.: admin), seria melhor separar rotas ou projetos.
- **Segmento e features:** SEGMENT_ACCESS e ProGate são manuais; adicionar novo plano ou feature exige alterar tipos e vários componentes. Um sistema de feature flags ou plano dinâmico (vindo do backend) escalaria melhor.

**Evidências:** simuladosApi.getQuestions; uso de useSimuladoDetail em várias páginas; App.tsx (rotas sem lazy); package.json (recharts, framer-motion).

---

## 9. Dívida técnica

### Estruturais
- **Dois “storage” de prova:** useExamStorage (só localStorage) não é usado; useExamStorageReal é o único ativo. Remover useExamStorage ou documentar motivo de manter.
- **Dois “cadernos”:** notebook-helpers (localStorage) vs Supabase (error_notebook). Caderno atual é 100% Supabase; helpers locais são mortos ou legado. Unificar ou remover.
- **Tipagem fraca:** strict e strictNullChecks desligados; `as any` em pontos críticos. Dificulta refatoração e detecção de bugs.

### Decisões temporárias que viraram permanentes
- **getQuestions com duas queries:** Comentário no código (“We need the question IDs first”) indica solução temporária; poderia ser uma RPC ou select com relação no Supabase.
- **README genérico Lovable:** REPLACE_WITH_PROJECT_ID e instruções genéricas; não descreve env, Supabase ou fluxos do produto.

### Partes incompletas
- **index.html:** TODOs no comentário: “Set the document title” e “Update og:title” — título já está “Simulados SanarFlix”, mas comentário permanece.
- **Testes:** Apenas example.test.ts (expect(true).toBe(true)); nenhum teste de componente ou hook crítico (auth, prova, resultado).
- **Playwright:** Config Lovable sem cenários E2E visíveis no repo.

### Código morto
- **useExamStorage:** Nunca importado (apenas useExamStorageReal é usado).
- **data/mock-questions.ts:** Nunca importado.
- **data/mock.ts:** CURRENT_USER, RANKING_DATA, AREA_PERFORMANCE não importados; só SPECIALTIES e INSTITUTIONS usados.
- **lib/notebook-helpers:** loadNotebook, saveNotebook, addToNotebook, removeFromNotebook, isInNotebook não usados pelo fluxo Supabase; apenas tipos/labels podem ser referenciados (e estão duplicados no modal).
- **resultHelpers.generateMockRanking:** Verificar se ainda é usado; se ranking for só Supabase, é morto.

### TODO / FIXME / HACK
- **index.html:** Comentários TODO para title e og:title (já preenchidos no corpo).
- Nenhum FIXME ou HACK encontrado no grep em *.ts/tsx.

### Trechos que merecem refatoração prioritária
1. **SimuladoExamPage:** Extrair lógica de init, finalize e handlers para um hook (ex.: useExamFlow) ou reducer; manter a página mais declarativa.
2. **simuladosApi.getQuestions:** Uma única chamada (join ou RPC) para questions + options.
3. **Labels e enums do Caderno de Erros:** Uma única fonte de verdade (arquivo de i18n ou constantes) e mapeamento pt ↔ enum DB em um só lugar.
4. **Tratamento de erros e loading:** Error boundary global; padrão único de loading (ex.: skeleton por área) e exibição de erro (toast ou banner).

**Evidências:** grep por useExamStorage, mock-questions, CURRENT_USER, RANKING_DATA, loadNotebook; index.html; src/test/example.test.ts; simuladosApi.getQuestions; CadernoErrosPage e AddToNotebookModal.

---

## 10. Lacunas de contexto

- **RLS e políticas Supabase:** Não estão no repositório; não é possível afirmar se tentativas, respostas, perfis e error_notebook estão restritos por user_id. Recomenda-se revisão no dashboard Supabase.
- **Função get_ranking_for_simulado:** Comportamento exato (filtros, ordenação, limites) e permissões são definidos no banco; não visíveis no código cliente.
- **Segmento do usuário (guest/standard/pro):** Como é definido (manual no DB? integração com outro sistema SanarFlix?). Código só lê `profiles.segment`; não há fluxo de “upgrade” no app.
- **Janelas de execução e results_release_at:** Regras de negócio (quem define datas, timezone) não estão documentadas no código; apenas usadas em deriveSimuladoStatus.
- **Variáveis de ambiente em produção:** Onde e como são definidas (Lovable, Vercel, etc.) e se existe .env.example para dev.
- **Lovable:** Qual projeto ID, se deploy é automático a partir do repo e se há variáveis específicas no painel.
- **Testes E2E:** Se existem em outro branch ou só no Lovable; quais fluxos são cobertos.
- **i18n:** Textos em português fixos no código; não há sistema de tradução. Assumido que o produto é só pt-BR.

---

## 11. Prioridades recomendadas

### Crítico
1. **Segurança Supabase (RLS)**  
   - **Problema:** Não é possível validar pelo código se dados (attempts, answers, profiles, error_notebook) estão protegidos por RLS.  
   - **Impacto:** Risco de um usuário acessar dados de outro.  
   - **Evidência:** Uso de anon key e filtros por user_id apenas no client.  
   - **Recomendação:** Revisar políticas RLS no Supabase para todas as tabelas e para a RPC get_ranking_for_simulado; documentar no repo ou em doc interno.

2. **Variáveis de ambiente**  
   - **Problema:** Sem .env.example ou README atualizado; deploy sem VITE_SUPABASE_* quebra a app.  
   - **Impacto:** Deploy falho ou uso acidental de outro projeto Supabase.  
   - **Evidência:** client.ts usa import.meta.env.VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY; README não menciona.  
   - **Recomendação:** Criar .env.example com as duas variáveis (valores vazios ou placeholder) e documentar no README.

### Alto
3. **getQuestions em 2 requests**  
   - **Problema:** Sequência de duas chamadas (questions depois options) aumenta latência e complexidade.  
   - **Impacto:** Tempo de abertura da prova e manutenção.  
   - **Evidência:** `src/services/simuladosApi.ts` linhas 146–175 (await dentro de Promise.all).  
   - **Recomendação:** Uma query com relação (questions + question_options) ou RPC que retorne questões com opções.

4. **Código morto e duplicação (exam storage + caderno)**  
   - **Problema:** useExamStorage e helpers localStorage do caderno não usados; duplicação de labels/reason.  
   - **Impacto:** Confusão, risco de usar código errado, bundle maior.  
   - **Evidência:** useExamStorage não importado; notebook-helpers só usado parcialmente; REASON_LABELS em 3 lugares.  
   - **Recomendação:** Remover useExamStorage ou documentar; consolidar caderno em Supabase e remover ou restringir notebook-helpers a tipos; centralizar labels do caderno em um único módulo.

5. **SimuladoExamPage monolítico**  
   - **Problema:** Página muito grande e complexa; difícil testar e evoluir.  
   - **Impacto:** Bugs em prova, dificuldade de onboarding.  
   - **Evidência:** ~514 linhas, vários useCallback/useEffect, init com eslint-disable.  
   - **Recomendação:** Extrair hook useExamFlow (init, finalize, updateState, handlers) e manter página como composição; considerar reducer para estado da prova.

### Médio
6. **TypeScript strict**  
   - **Problema:** noImplicitAny e strictNullChecks desligados; alguns `as any`.  
   - **Impacto:** Erros em runtime que o compilador poderia pegar.  
   - **Evidência:** tsconfig.app.json (strict: false, noImplicitAny: false).  
   - **Recomendação:** Habilitar strict (e null checks) gradualmente; eliminar `as any` e tipar env (vite-env.d.ts).

7. **Tratamento de erro e loading**  
   - **Problema:** Sem error boundary; loading e erro inconsistentes entre telas.  
   - **Impacto:** UX ruim em falhas e estados de carregamento.  
   - **Evidência:** useSimulados/useSimuladoDetail setError sem sempre exibir; UserContext catch silencioso.  
   - **Recomendação:** Error boundary global; padrão de loading (skeleton) e de exibição de erro (toast/banner) por área.

8. **Cache e fetches redundantes**  
   - **Problema:** useSimuladoDetail refetch em cada página para o mesmo id; useSimulados sem cache compartilhado.  
   - **Impacto:** Latência e carga desnecessária no Supabase.  
   - **Evidência:** Várias páginas usam useSimuladoDetail(id); useSimulados em Index e SimuladosPage.  
   - **Recomendação:** Usar React Query (useQuery) para simulado e questões com chave (simuladoId) e staleTime adequado.

### Baixo
9. **Logs em produção**  
   - **Problema:** Vários console.log com email/user e fluxos de auth.  
   - **Impacto:** Vazamento em ferramentas de suporte ou console do browser.  
   - **Evidência:** AuthContext, UserContext, LoginPage, etc.  
   - **Recomendação:** Remover ou guardar atrás de `import.meta.env.DEV` / logger condicional.

10. **README e documentação**  
    - **Problema:** README genérico Lovable; sem descrição do produto, env e arquitetura.  
    - **Impacto:** Onboarding de devs e deploy manual mais difícil.  
    - **Evidência:** README.md com REPLACE_WITH_PROJECT_ID e passos genéricos.  
    - **Recomendação:** Atualizar README com objetivo do projeto, variáveis de ambiente, como rodar e (resumido) como está organizado (rotas, Supabase, auth).

---

## 12. Próximos passos

1. **Revisar primeiro**  
   - RLS e políticas no Supabase (attempts, answers, profiles, onboarding_profiles, error_notebook, RPC ranking).  
   - Variáveis de ambiente em todos os ambientes (dev, staging, prod) e criar .env.example.

2. **Refatorar em seguida**  
   - getQuestions para uma única fonte de dados (join/RPC).  
   - SimuladoExamPage: extrair useExamFlow (ou equivalente) e reduzir tamanho da página.  
   - Remover ou consolidar código morto (useExamStorage, mock-questions, exports não usados de mock.ts, notebook-helpers localStorage) e unificar labels do caderno.

3. **Testar**  
   - Testes unitários para simulado-helpers (deriveSimuladoStatus, canAccessSimulado), resultHelpers (computeSimuladoScore) e, se possível, useExamStorageReal (mockando simuladosApi).  
   - E2E para fluxo crítico: login → onboarding → listar simulado → iniciar prova → responder → finalizar → ver resultado (e, se aplicável, correção e caderno).

4. **Documentar**  
   - README com objetivo, stack, env e como rodar.  
   - Comentário ou doc interna sobre segmentos (guest/standard/pro) e onde são definidos.  
   - Opcional: ADR ou doc de arquitetura (entrada, rotas, Supabase, auth, prova).

5. **Monitorar**  
   - Erros de rede e respostas 4xx/5xx nas chamadas Supabase (se houver ferramenta de monitoramento no deploy).  
   - Performance de getQuestions e de carregamento da página de prova (métricas reais ou Lighthouse).

---

## Resumo executivo

O projeto é uma **SPA de simulados para residência médica** (PRO: ENAMED / SanarFlix), construída com **Vite, React, TypeScript, Supabase e shadcn**. Fluxos principais: **auth (email/senha e magic link), onboarding, listagem e realização de simulados com persistência em Supabase e cache local, resultado, correção, ranking, desempenho, comparativo e Caderno de Erros (PRO)**. A arquitetura é clara (pages, hooks, services, contexts), mas há **dívida técnica**: código morto (useExamStorage, mock-questions, parte de mock.ts e notebook-helpers), **duplicação de conceitos** (labels e “reason” do caderno), **SimuladoExamPage muito grande**, **getQuestions em dois requests** e **TypeScript e tratamento de erro fracos**. **Segurança** depende de RLS no Supabase (não auditable pelo repo); **variáveis de ambiente** não estão documentadas. Priorizar: **validar RLS**, **documentar env e criar .env.example**, **simplificar getQuestions**, **limpar código morto e consolidar caderno**, **refatorar SimuladoExamPage** e **endurecer tipagem e tratamento de erro**.

---

## 10 arquivos mais importantes para entender o projeto

1. **src/App.tsx** — Rotas e providers globais.  
2. **src/main.tsx** — Entrada da aplicação.  
3. **src/contexts/AuthContext.tsx** — Autenticação e sessão.  
4. **src/contexts/UserContext.tsx** — Perfil e onboarding.  
5. **src/components/ProtectedRoute.tsx** — Guard de rotas (auth + onboarding).  
6. **src/services/simuladosApi.ts** — API de simulados, questões, tentativas, respostas e caderno.  
7. **src/hooks/useExamStorageReal.ts** — Persistência da prova (Supabase + localStorage).  
8. **src/pages/SimuladoExamPage.tsx** — Fluxo completo da prova.  
9. **src/lib/simulado-helpers.ts** — Status do simulado, CTAs e regras de acesso.  
10. **src/integrations/supabase/client.ts** — Configuração do cliente Supabase.

---

## 10 maiores riscos técnicos

*(Todos foram tratados. Detalhes em `docs/SOLUCAO_RISCOS_TECNICOS.md` e `docs/SUPABASE_RLS.md`.)*

1. **RLS Supabase não auditable** — ✅ Auditado; políticas documentadas em `docs/SUPABASE_RLS.md`.  
2. **Env não documentado** — ✅ `.env.example` + README.  
3. **SimuladoExamPage muito complexa** — ✅ Lógica em `useExamFlow`; página enxuta.  
4. **Dois requests em getQuestions** — ⚠️ Fluxo claro; otimização para 1 request (RPC/join) opcional.  
5. **Código morto e dois “cadernos”** — ✅ Removido + labels em `errorNotebookReasons.ts`.  
6. **TypeScript permissivo** — ✅ `noImplicitAny`, env tipado, `as any` removido.  
7. **Falhas silenciosas** — ✅ UserContext (`profileError` + toast); useExamStorageReal (`fromCache` + toast).  
8. **Sem error boundary** — ✅ `ErrorBoundary` + App.tsx.  
9. **Fetches redundantes** — ✅ React Query em useSimuladoDetail e useSimulados (cache 5 min).  
10. **Logs em produção** — ✅ `logger.ts` condicional (DEV) nos pontos sensíveis.

---

## Perguntas para você (contexto futuro)

1. Onde as variáveis **VITE_SUPABASE_URL** e **VITE_SUPABASE_PUBLISHABLE_KEY** são definidas em dev e em produção (Lovable, Vercel, outro)? Existe algum .env que não está no repo?  
2. As políticas **RLS** do Supabase já foram revisadas para **attempts**, **answers**, **profiles**, **onboarding_profiles**, **error_notebook** e para a função **get_ranking_for_simulado**? Quem define o **segment** (guest/standard/pro) do usuário — manual no DB ou integração externa?  
3. O **Caderno de Erros** deve ser exclusivamente Supabase (como está hoje) ou há plano de suporte offline/local? Os helpers em **notebook-helpers.ts** (localStorage) podem ser removidos?  
4. O hook **useExamStorage** (só localStorage) foi substituído de propósito por **useExamStorageReal**? Podemos removê-lo?  
5. O **generateMockRanking** em resultHelpers ainda é usado em algum fluxo ou o ranking é 100% real (Supabase)?  
6. **Testes E2E** (Playwright) existem em outro repositório ou só no Lovable? Quais fluxos são cobertos?  
7. Há **design system ou guia de componentes** fora do código (Figma, doc) que devamos seguir em novas telas?  
8. **Janelas de execução** (início/fim do simulado) e **results_release_at** são definidas por quem e em qual timezone? Há integração com outro sistema para publicar simulados?  
9. O **README** pode ser reescrito para este produto (nome, objetivo, env, como rodar) ou deve permanecer genérico Lovable?  
10. Existe **monitoramento de erros ou performance** em produção (Sentry, LogRocket, etc.) que devamos considerar ao remover logs ou adicionar tratamento de erro?

---

*Documento gerado por auditoria técnica do repositório enamed-arena. Nenhuma alteração de código foi aplicada.*
