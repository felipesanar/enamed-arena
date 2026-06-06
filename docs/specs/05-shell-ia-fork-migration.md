# Spec 05 — Casca Unificada + IA: Resolução do Fork e Migração

**Produto:** SanarFlix PRO Simulados (ENAMED)
**Escopo:** Arquitetura de navegação · Hierarquia de informação · Card unificado · Estados de página · Plano de migração do fork · Checklist de anti-padrões Medway
**Status:** Pronto para implementação — Fase 1
**Data:** Junho/2026

---

## Contexto e decisão arquitetural

O produto possui hoje **duas implementações paralelas e incompatíveis** do Caderno de Erros:

| Dimensão | Produção (`src/pages/Caderno*` + `src/components/AddToNotebookModal.tsx`) | Sandbox (`src/sandbox/caderno/`) |
|---|---|---|
| Rota | `/caderno-erros` e `/caderno-erros/revisao` | `/sandbox/caderno` |
| Hero/UI | `HeroStatusCard` + `FilterBar` + `QueueRow` inline em `CadernoErrosPage` | `PageHero` + `FilterBar` sandbox + `HeroNextCard` + `EntryCard` |
| Motor de revisão | `CadernoRevisaoPage` completo (Prof. San, snooze, sessão, atalhos, resumo) | Ausente — `markResolved` local apenas |
| Dados | `simuladosApi` (Supabase) | `MOCK_ENTRIES` estático |
| Modal de adição | `src/components/AddToNotebookModal.tsx` com API real | `src/sandbox/caderno/components/AddToNotebookModal/` sem API |
| Tokens CSS | Tailwind + design system | `tokens.css` local divergente |
| Tipos de erro | `src/lib/errorNotebookReasons.ts` (`DbReason`, `LocalReason`) | `src/sandbox/caderno/errorTypes.ts` (`ErrorTypeKey`, mapeamento `dbKey`) |

**Decisão final, não reversível:** a casca visual do sandbox (hero-first, `HeroNextCard`, `EntryCard` compacto, `ZeroPendingState`, `FilterBar` em duas faixas, `AddToNotebookModal` de 2 passos) vira a camada de UI de produção, re-acoplada ao motor já existente em `CadernoRevisaoPage` + `simuladosApi`.

---

## 1. Arquitetura de Navegação e Rotas

### 1.1 Estrutura de URLs

```
/caderno                          → CadernoPage (layout com abas, gate PRO)
/caderno/favoritos                → aba Favoritos (Fase 2)
/caderno/anotacoes                → aba Anotações (Fase 2)
/caderno/flashcards               → aba Flashcards (Fase 2)
/caderno/insights                 → aba Insights (Fase 2)
/caderno/revisao                  → CadernoRevisaoPage (sessão de revisão sequencial)
```

> As rotas `/caderno-erros` e `/caderno-erros/revisao` continuam vivas durante a transição como aliases com `<Navigate to="/caderno" replace />` e `<Navigate to="/caderno/revisao" replace />`. Só são removidas após deploy e confirmação de que não há deep-links externos ativos.

### 1.2 Registro em App.tsx

```tsx
// Dentro do layout premium (ProtectedRoute + DashboardLayout)
<Route path="caderno" element={<CadernoPage />} />
<Route path="caderno/revisao" element={<CadernoRevisaoPage />} />

// Aliases de retrocompatibilidade (remover em sprint seguinte)
<Route path="caderno-erros" element={<Navigate to="/caderno" replace />} />
<Route path="caderno-erros/revisao" element={<Navigate to="/caderno/revisao" replace />} />

// Sandbox permanece em desenvolvimento, não entra em build de prod
<Route path="/sandbox/caderno" element={<Suspense ...><SandboxCadernoPage /></Suspense>} />
```

### 1.3 Abas e fases

| Aba | Rota (path relativo ao layout) | Fase | Observação |
|---|---|---|---|
| **Revisar** (default) | `/caderno` | Fase 1 | Erros + recall ativo + SRS |
| **Favoritos** | `/caderno/favoritos` | Fase 2 | Curadoria de questões de alto valor |
| **Anotações** | `/caderno/anotacoes` | Fase 2 | Rich-text + título + autosave |
| **Flashcards** | `/caderno/flashcards` | Fase 2 | Decks com imagem, SRS compartilhado |
| **Insights** | `/caderno/insights` | Fase 2 | Prof. San macro, padrões entre erros |

**Fase 1** entrega apenas a aba Revisar funcional. As demais abas são renderizadas como links na barra de abas com badge "Em breve" e estado `disabled` — a arquitetura de rota acomoda todas desde o início para não forçar reestruturação posterior.

A navegação entre abas usa `<NavLink>` com URL própria (corrige anti-padrão Medway m1: sem URL).

### 1.4 Sidebar

`SidebarProSection` atualizado:

```tsx
// to="/caderno"  (era /caderno-erros)
// label: "Caderno"  (mais curto para acomodar abas futuras)
```

`MobileBottomNav`: adicionar entrada "Caderno" com ícone `BookOpen` apontando para `/caderno`.

---

## 2. Hierarquia de Informação — Aba Revisar (mockup textual)

```
┌─────────────────────────────────────────────────────────────────────┐
│  CADERNO  [Revisar ●] [Favoritos] [Anotações] [Flashcards] [Insights]│
│  (tabs com URL própria; abas Fase 2 = disabled + badge "Em breve")   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────── HERO (dark, wine gradient) ──────────────────┐ │
│  │  Revisão ativa · PRO                           🔥 7 dias         │ │
│  │  Seu progresso no Caderno                                         │ │
│  │  ████████████████░░░░░░  68%   [32 resolvidas de 47]             │ │
│  │  ● 15 pendentes  ● 32 resolvidas · 4 especialidades              │ │
│  │  ⏱ Faltam 23 dias para o ENAMED 2026  ← countdown (Fase 1)      │ │
│  └────────────────────────────────────────────────────────────────── │
│                                                                       │
│  ┌─────────────── CARD "PARA REVISAR AGORA" ─────────────────────┐   │
│  │  [Avatar Prof. San ●]  Modo revisão com Prof. San              │   │
│  │  Revise as 15 pendentes com análise de IA                      │   │
│  │                                          [▶ Iniciar sessão]    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  FILTROS (faixa 1 — Causa)                                            │
│  [Todos 15] [● Lacuna 6] [● Memória 4] [● Atenção 3] [● Diferencial] │
│                                                                       │
│  FILTROS (faixa 2 — Área, se >1)                                      │
│  [Todas] [Cardiologia] [Nefrologia] [Pneumologia]                     │
│                                                                       │
│  BUSCA  [🔍 Buscar questão, área ou simulado…]  (Fase 1)              │
│                                                                       │
│  ──── DEVIDAS HOJE (6) ────────────────────────────────────────────   │
│  [EntryCard] Q14 · Cardio › IAM com supra        [Lacuna] [volta 0d] │
│  [EntryCard] Q31 · Nefro › Lesão aguda           [Memória][volta 0d] │
│  …                                                                    │
│                                                                       │
│  ──── EM APRENDIZADO (5) ──────────────────────────────────────────   │
│  [EntryCard] Q7  · Pneumo › DPOC exacerbado      [Atenção][2ª revisão│
│  …                                                                    │
│                                                                       │
│  ──── AGENDADAS (4) ────────────────────────────────────────────────  │
│  [EntryCard] Q22 · Cardio › FA                   [Diferencial]volta 3d│
│  …                                                                    │
│                                                                       │
│  ──── DOMINADAS ▸ ver 32 dominadas (colapsável) ───────────────────   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 Seções da fila segmentada

| Seção | Critério de inclusão | Ordem | Comportamento |
|---|---|---|---|
| **Devidas hoje** | `srs_due_at <= now` E não dominada | `srs_due_at` ASC | CTA primário — alimenta a sessão de revisão |
| **Em aprendizado** | `srs_reps >= 1` E `srs_due_at > now` E `srs_interval <= 14d` | `srs_due_at` ASC | Progresso visível — "Nx revisão" |
| **Agendadas** | `srs_due_at > now` E `srs_interval > 14d` | `srs_due_at` ASC | "Volta em Nd" |
| **Dominadas** | `mastered_at IS NOT NULL` | `mastered_at` DESC | Colapsável, mostra n total |

> **Fase 1:** enquanto as colunas SRS não existirem, o critério de segmentação usa o campo legado: Devidas hoje = `next_review_at <= now OR next_review_at IS NULL`, Agendadas = `next_review_at > now`, Dominadas = `resolved_at IS NOT NULL`. A migração para SRS é transparente para a UI — apenas o critério da query muda.

### 2.2 Countdown ENAMED

Calculado client-side a partir de uma data configurável (por enquanto hardcoded como data do próximo ENAMED na constante `ENAMED_DATE` em `src/lib/constants.ts`). Exibido no hero como "Faltam N dias para o ENAMED". Quando `N <= 0`, o componente não exibe a linha.

---

## 3. Componente de Card Unificado — `NotebookEntryCard`

### 3.1 Especificação do componente

Um único componente `NotebookEntryCard` substitui tanto `QueueRow` (produção) quanto `EntryCard` (sandbox) e será usado em todas as abas.

**Arquivo alvo:** `src/components/caderno/NotebookEntryCard.tsx`

**Hierarquia de informação (anatomia do card):**

```
┌──────────────────────────────────────────────────────────────────┐
│▌  ← barra de cor (3px, colorBase da causa)                       │
│                                                                   │
│  Linha 1: Q{n} · {Área › Tema}        [badge causa] [peso ENAMED]│
│  Linha 2: {Simulado/Prova} · {data relativa}                     │
│  Linha 3: {preview 2 linhas do enunciado} ▸ expandir             │
│  Linha 4: Sua resposta → Correta  +  nota do aluno (se houver)  │
│                                                                   │
│  Rodapé:  [Revisar] [Flashcard¹] [Aula¹] [⋯ mais]  |status SRS │
└──────────────────────────────────────────────────────────────────┘
¹ Fase 2
```

**Props do componente:**

```ts
interface NotebookEntryCardProps {
  entry: NotebookEntry;             // tipo unificado (ver §5.1)
  variant?: 'queue' | 'compact';   // queue=padrão, compact=dominadas
  onReview?: (id: string) => void;
  onRemove?: (id: string) => void;
  onToggleMastered?: (id: string, mastered: boolean) => void;
  showSrsStatus?: boolean;          // mostra "volta em Nd"
  showPreview?: boolean;            // linha 3 — expansível
}
```

**Regras de comportamento:**

- **Barra de cor:** usa `meta.colorBase` da causa do erro (via `getReasonMeta`). Causa derivada de `entry.reason` (campo `DbReason`).
- **Badge causa:** pill colorido, sempre com label (não só ícone) — corrige Medway m13.
- **Peso ENAMED:** badge cinza "Alta cobrança" / "Média cobrança" baseado em `entry.enadWeight` (campo Fase 2; omitido se null).
- **Preview expansível:** 2 linhas truncadas do enunciado + botão "ver mais" que expande inline sem modal — corrige Medway (card truncado sem preview).
- **Status SRS:** texto "volta em 3d" / "devida hoje" / "dominada" no canto inferior direito, semântica por cor.
- **Ações de rodapé:** [Revisar] vai para `/caderno/revisao?entry={id}`; [⋯] abre um `DropdownMenu` shadcn com "Editar anotação", "Remover". Remover sempre exige confirmação + undo com toast de 5s — corrige Medway m4.
- **Ícones sempre com label ou tooltip** (`TooltipContent` do shadcn) — corrige Medway m13.
- **Estado ativo nos filtros:** quando um filtro está ativo, a cor do badge é aplicada ao próprio chip + ícone de check (já existe na produção, manter) — corrige Medway m2.

### 3.2 Inconsistências resolvidas

| Problema Medway | Como este card resolve |
|---|---|
| m2: filtro sem estado ativo visível | FilterChip com `aria-checked` + cor ativa explícita (já implementado em produção, preservar) |
| m4: sem confirmação de exclusão | DropdownMenu "Remover" → toast com ToastAction "Desfazer" (5s) antes de persistir |
| m5: sem toast ao salvar | Toda ação de estado emite `toast({ title, description })` |
| m6: nomenclatura divergente entre abas | Um único `FilterBar` component com labels fixos "Causa" e "Área" — igual em todas as abas |
| m10: inconsistência de badges | Único card, mesma estrutura, em todas as abas |
| m13: ícones sem label | `Tooltip` + `aria-label` em todo ícone de ação |
| m14: sem skeleton | `NotebookEntryCardSkeleton` para loading state |
| Preview truncado | Linha 3 com expansão inline |

---

## 4. Estados de Interface de Nível de Página

| Estado | Componente | Conteúdo | Gatilho |
|---|---|---|---|
| **Loading** | `CadernoSkeleton` | Skeleton do hero (dark, `h-[200px]`) + 2 faixas de chips + 4 cards skeleton | `loading === true` na query inicial |
| **Erro de carregamento** | `EmptyState variant="error"` | "Não foi possível carregar o Caderno" + "Verifique sua conexão" + botão Tentar de novo | `loadError && entries.length === 0` |
| **Vazio (nunca adicionou)** | `EmptyState` customizado | Ícone BookOpen, "Seu Caderno está vazio", instrução + CTA "Ver simulados" | `entries.length === 0 && !loadError` |
| **Dashboard ativo** | `CadernoContent` | Hero + filtros + card CTA + fila segmentada | Estado nominal |
| **Zero pendentes** | `ZeroPendingState` | "Caderno zerado 🎯" + resolvedCount + streak + próxima data devida + "Ver dominadas" | `entries.length > 0 && devidas.length === 0 && emAprendizado.length === 0` |
| **Filtro sem resultado** | Inline na fila | "Nenhuma questão corresponde aos filtros" + botão "Limpar filtros" | `filtered.length === 0 && !allResolved` |
| **Sessão de revisão** | `CadernoRevisaoPage` | Recall ativo: enunciado → marcar+confiança → revelar+Prof. San → autoavaliação | Navegação para `/caderno/revisao` |
| **Resumo de sessão** | `SessionSummary` | Dominadas/agendadas/restantes/tempo + top-3 áreas + CTA | `finished === true` ou fila esvaziada com atividade |

**Regra de transição:** o estado "Vazio" não deve ser exibido durante o primeiro carregamento (evitar flash). O skeleton é mostrado até `loading === false`, depois os demais estados são avaliados.

---

## 5. Plano de Migração do Fork

### 5.1 Tipo unificado `NotebookEntry`

O maior problema técnico do fork é a divergência de tipos:

| Campo | Produção (`CadernoErrosPage`) | Sandbox (`mockEntries.ts`) | Unificado |
|---|---|---|---|
| Causa | `reason: string` (DbReason) | `errorType: ErrorTypeKey` | `reason: DbReason` |
| Data criação | `addedAt: string` | `createdAt: string` | `addedAt: string` |
| Nota | `learningNote: string \| null` | `note: string` | `learningNote: string \| null` |
| SRS | ausente | ausente | `nextReviewAt`, `srsInterval`, etc. (Fase 1+) |
| Dominada | `resolvedAt: string \| null` | `resolvedAt: string \| null` | `resolvedAt: string \| null` |

O tipo canônico vive em `src/types/index.ts` como `NotebookEntry`. O sandbox usa seu próprio tipo local — ao migrar, os componentes sandbox passam a importar de `@/types`.

### 5.2 Tabela de destino dos componentes existentes

| Componente/arquivo | Localização atual | Destino | Nota |
|---|---|---|---|
| `CadernoErrosPage.tsx` | `src/pages/` | **RENAME-TO** `CadernoPage.tsx` + refatorar para layout com abas | Shell principal; o conteúdo da aba Revisar vai para `CadernoRevisarTab.tsx` |
| `CadernoRevisaoPage.tsx` | `src/pages/` | **KEEP** (path `/caderno/revisao`) | Motor de revisão permanece intacto; apenas atualizar links internos de `/caderno-erros` → `/caderno` |
| `HeroStatusCard` (inline em CadernoErrosPage) | `src/pages/CadernoErrosPage.tsx` | **MERGE-INTO** `src/components/caderno/PageHero.tsx` | Fundir visual do sandbox (grid de stats, ProgressBar) com countdown ENAMED da produção |
| `FilterBar` (inline em CadernoErrosPage) | `src/pages/CadernoErrosPage.tsx` | **MERGE-INTO** `src/components/caderno/FilterBar.tsx` | Preservar `aria-checked` da produção; adicionar faixa de busca (Fase 1) |
| `QueueRow` (inline em CadernoErrosPage) | `src/pages/CadernoErrosPage.tsx` | **DROP** → substituído por `NotebookEntryCard` | Ver §3 |
| `ZeroPendingCard` (inline em CadernoErrosPage) | `src/pages/CadernoErrosPage.tsx` | **MERGE-INTO** `src/components/caderno/ZeroPendingState.tsx` | Herdar visual celebratório do sandbox; adicionar "próxima data devida" |
| `CadernoSkeleton` (inline em CadernoErrosPage) | `src/pages/CadernoErrosPage.tsx` | **MOVE-TO** `src/components/caderno/CadernoSkeleton.tsx` | — |
| `AddToNotebookModal.tsx` | `src/components/` | **KEEP + ENHANCE** | Este modal tem API real; é o de produção. Receber melhorias visuais do sandbox (ReasonCard, StepIndicator, DuplicateBanner) |
| `PageHero` (sandbox) | `src/sandbox/caderno/components/PageHero.tsx` | **MERGE-INTO** `src/components/caderno/PageHero.tsx` | Fonte do visual (grid de stats, ProgressBar animada, glow decorativo) |
| `HeroNextCard` (sandbox) | `src/sandbox/caderno/components/HeroNextCard.tsx` | **MERGE-INTO** `src/components/caderno/HeroNextCard.tsx` | CTA primário "Próxima para revisar" → adaptar para abrir sessão de revisão |
| `EntryCard` (sandbox) | `src/sandbox/caderno/components/EntryCard.tsx` | **DROP** → substituído por `NotebookEntryCard` | Serve de referência visual mas não tem dados reais |
| `FilterBar` (sandbox) | `src/sandbox/caderno/components/FilterBar.tsx` | **DROP** → substituído pelo FilterBar de produção migrado | — |
| `EmptyState` (sandbox) | `src/sandbox/caderno/components/EmptyState.tsx` | **MERGE-INTO** `src/components/EmptyState.tsx` | Verificar paridade; o EmptyState de produção já tem `variant="error"` |
| `ZeroPendingState` (sandbox) | `src/sandbox/caderno/components/ZeroPendingState.tsx` | **MERGE-INTO** `src/components/caderno/ZeroPendingState.tsx` | Visual do sandbox, dados reais de produção |
| `AddToNotebookModal` (sandbox) | `src/sandbox/caderno/components/AddToNotebookModal/` | **DROP** (subcomponentes migrar) | A lógica é mock; subcomponentes visuais (ReasonCard, StepIndicator, DuplicateBanner) podem ser extraídos para o modal de produção |
| `ReasonCard.tsx` (sandbox) | `src/sandbox/caderno/components/AddToNotebookModal/ReasonCard.tsx` | **MERGE-INTO** `src/components/AddToNotebookModal.tsx` | Visual superior ao atual |
| `StepIndicator.tsx` (sandbox) | `src/sandbox/caderno/components/AddToNotebookModal/StepIndicator.tsx` | **MERGE-INTO** `src/components/AddToNotebookModal.tsx` | — |
| `DuplicateBanner.tsx` (sandbox) | `src/sandbox/caderno/components/AddToNotebookModal/DuplicateBanner.tsx` | **MERGE-INTO** `src/components/AddToNotebookModal.tsx` | — |
| `useNotebookEntries.ts` (sandbox) | `src/sandbox/caderno/hooks/` | **DROP** | Substituído por `simuladosApi.getErrorNotebook` + React Query |
| `useReviewStreak.ts` (sandbox) | `src/sandbox/caderno/hooks/` | **MERGE-INTO** `src/hooks/useNotebookStreak.ts` | Lógica de streak é reutilizável; trocar deps de mock por dados reais |
| `errorTypes.ts` (sandbox) | `src/sandbox/caderno/errorTypes.ts` | **DROP** | Fonte da verdade é `src/lib/errorNotebookReasons.ts`; verificar cobertura de todos os `ErrorTypeKey` → `DbReason` |
| `tokens.css` (sandbox) | `src/sandbox/caderno/tokens.css` | **DROP** | Tokens migram para Tailwind/CSS vars do design system |
| `mockEntries.ts` | `src/sandbox/caderno/mockEntries.ts` | **DROP** | Não entra em produção |
| `CadernoSandboxPage.tsx` | `src/sandbox/caderno/CadernoSandboxPage.tsx` | **KEEP** (rota `/sandbox/caderno`) | Rota de desenvolvimento; manter para prototipagem de Fase 2 |
| `ui/Chip.tsx` (sandbox) | `src/sandbox/caderno/ui/Chip.tsx` | **DROP** | Substituído por `FilterChip` da produção (já no FilterBar de produção) |
| `ui/ProgressBar.tsx` (sandbox) | `src/sandbox/caderno/ui/ProgressBar.tsx` | **MERGE-INTO** `src/components/caderno/PageHero.tsx` | Mover inline ou extrair como `NotebookProgressBar` |
| `ui/Toast*.tsx` (sandbox) | `src/sandbox/caderno/ui/Toast.tsx` + `ToastProvider.tsx` | **DROP** | Produção usa `@/hooks/use-toast` + shadcn/Sonner |
| `SidebarProSection.tsx` | `src/components/premium/sidebar/` | **UPDATE** | `to="/caderno"`, label "Caderno" |

### 5.3 Novos arquivos a criar

| Arquivo | Responsabilidade |
|---|---|
| `src/pages/CadernoPage.tsx` | Shell com layout de abas + gate PRO + aba Revisar ativa |
| `src/components/caderno/PageHero.tsx` | Hero dark unificado (stats grid + ProgressBar + streak + countdown ENAMED) |
| `src/components/caderno/HeroNextCard.tsx` | CTA "Para revisar agora" com link para `/caderno/revisao` |
| `src/components/caderno/NotebookEntryCard.tsx` | Card unificado (§3) |
| `src/components/caderno/NotebookEntryCardSkeleton.tsx` | Skeleton do card |
| `src/components/caderno/FilterBar.tsx` | Filtros (causa + área + busca) — duas faixas de chips + input |
| `src/components/caderno/ZeroPendingState.tsx` | "Caderno zerado 🎯" com próxima data devida |
| `src/components/caderno/CadernoSkeleton.tsx` | Skeleton de página completa |
| `src/components/caderno/TabBar.tsx` | Barra de abas com NavLink + badge "Em breve" para Fase 2 |
| `src/hooks/useNotebookStreak.ts` | Cálculo de streak (migrado de sandbox) |
| `src/lib/constants.ts` (ou adicionar a existente) | `ENAMED_DATE` para countdown |

### 5.4 Arquivos a deletar (após validação em produção)

```
src/sandbox/caderno/errorTypes.ts
src/sandbox/caderno/mockEntries.ts
src/sandbox/caderno/tokens.css
src/sandbox/caderno/hooks/useNotebookEntries.ts
src/sandbox/caderno/hooks/useReviewStreak.ts
src/sandbox/caderno/components/EntryCard.tsx
src/sandbox/caderno/components/FilterBar.tsx
src/sandbox/caderno/components/EmptyState.tsx          ← após merge
src/sandbox/caderno/components/ZeroPendingState.tsx    ← após merge
src/sandbox/caderno/components/HeroNextCard.tsx        ← após merge
src/sandbox/caderno/components/PageHero.tsx            ← após merge
src/sandbox/caderno/components/AddToNotebookModal/ReasonCard.tsx     ← após merge
src/sandbox/caderno/components/AddToNotebookModal/StepIndicator.tsx  ← após merge
src/sandbox/caderno/components/AddToNotebookModal/DuplicateBanner.tsx← após merge
src/sandbox/caderno/ui/Chip.tsx
src/sandbox/caderno/ui/ProgressBar.tsx
src/sandbox/caderno/ui/Toast.tsx
src/sandbox/caderno/ui/ToastProvider.tsx
```

`CadernoSandboxPage.tsx` permanece para uso em desenvolvimento.

### 5.5 Mudanças de rota em App.tsx

```
REMOVER:  <Route path="caderno-erros" element={<CadernoErrosPage />} />
REMOVER:  <Route path="caderno-erros/revisao" element={<CadernoRevisaoPage />} />
ADICIONAR:<Route path="caderno" element={<CadernoPage />} />
ADICIONAR:<Route path="caderno/revisao" element={<CadernoRevisaoPage />} />
ADICIONAR (temporário):
          <Route path="caderno-erros" element={<Navigate to="/caderno" replace />} />
          <Route path="caderno-erros/revisao" element={<Navigate to="/caderno/revisao" replace />} />
```

Lazy imports atualizados:
```ts
const CadernoPage = lazy(() => import('@/pages/CadernoPage'));
// CadernoRevisaoPage já importado — manter
```

### 5.6 Onde o sandbox precisa trocar mock por API real

| Ponto de mock | Substituto de produção |
|---|---|
| `MOCK_ENTRIES` em `CadernoSandboxPage` | `simuladosApi.getErrorNotebook(userId)` via React Query |
| `useNotebookEntries(MOCK_ENTRIES)` | `useQuery({ queryKey: ['notebook', userId], queryFn: ... })` |
| `markResolved` local | `simuladosApi.toggleResolvedEntry(id, userId, true)` com optimistic update |
| `handleSave` setTimeout mock no `AddToNotebookModal` sandbox | `simuladosApi.addToErrorNotebook(...)` do modal de produção |
| `showToast` do `ToastProvider` sandbox | `toast(...)` de `@/hooks/use-toast` |

### 5.7 Links internos a atualizar

Após renomear a rota, os seguintes pontos têm hardcode de `/caderno-erros`:

| Arquivo | Linha(s) | De | Para |
|---|---|---|---|
| `CadernoRevisaoPage.tsx` | ~283, ~287 | `/caderno-erros` | `/caderno` |
| `SessionSummary` (dentro de RevisaoPage) | Link "Voltar ao caderno" | `/caderno-erros` | `/caderno` |
| `SidebarProSection.tsx` | `to="/caderno-erros"` | `/caderno-erros` | `/caderno` |
| `PremiumSidebarRailItem` (no SidebarProSection) | `to="/caderno-erros"` | `/caderno-erros` | `/caderno` |
| `CadernoErrosPage.tsx` (CTA hero link) | Link `to="/caderno-erros/revisao"` | `/caderno-erros/revisao` | `/caderno/revisao` |
| `trackEvent` calls | `'caderno_erros_viewed'` etc. | manter nomes de eventos (analytics é append-only) | — |

### 5.8 Ordem de execução segura (sem quebrar produção)

A estratégia usa **rota nova em paralelo**: a nova `/caderno` existe lado a lado com a antiga `/caderno-erros` até que a migração esteja validada.

```
Sprint N, Passo 1 — Setup paralelo (sem tocar /caderno-erros)
  a. Criar src/components/caderno/ com os novos componentes (PageHero, HeroNextCard,
     NotebookEntryCard, FilterBar, ZeroPendingState, CadernoSkeleton, TabBar)
  b. Criar src/pages/CadernoPage.tsx importando produção + novos componentes
  c. Adicionar rota /caderno → CadernoPage em App.tsx (SEM remover /caderno-erros)
  d. Atualizar SidebarProSection para apontar para /caderno
     → /caderno-erros segue acessível via URL direta como fallback

Sprint N, Passo 2 — Validação em staging
  a. QA completo em /caderno (todos os estados, filtros, sessão de revisão)
  b. Confirmar que /caderno-erros ainda redireciona corretamente via Navigate

Sprint N, Passo 3 — Consolidação
  a. Converter /caderno-erros para Navigate redirect
  b. Atualizar links internos em CadernoRevisaoPage e SessionSummary
  c. Deletar arquivos sandbox marcados para DROP (exceto CadernoSandboxPage)
  d. Remover CSS classes `caderno-sandbox` dos componentes migrados

Sprint N+1 — Limpeza final
  a. Remover aliases /caderno-erros após confirmar ausência de links externos
  b. Deletar imports e lazy loaders de CadernoErrosPage
```

**Feature flag:** se a equipe preferir transição com feature flag em vez de rota paralela, a variável `VITE_CADERNO_NEW_SHELL=true` pode ser lida em `CadernoErrosPage` para redirecionar para `/caderno`. Isso centraliza a decisão de rollback num único ponto.

---

## 6. Checklist de Anti-padrões Medway — Requisitos de Componente

Cada item do Apêndice B da visão definitiva traduzido em requisito concreto de implementação:

### 6.1 Arquitetura (anti m1)
- [x] **URL própria obrigatória.** `/caderno` com abas sendo URLs distintas (`/caderno/favoritos` etc.). Nenhuma feature do caderno vive em modal sem URL. O `AddToNotebookModal` é um caso especial: é *disparado* da tela de correção e não precisa de URL própria, mas o destino (caderno) tem URL.

### 6.2 Editor único e consistente (anti m3)
- [x] **Um único comportamento de editor de nota.** `AddToNotebookModal` é o único editor de entrada. Quando Anotações (Fase 2) for implementada, usará o mesmo modal base — não um slide-over separado. O `dialog` shadcn é o padrão.
- [x] **Botão "Salvar" sempre visível** dentro do viewport do modal — verificar em mobile antes de PR.

### 6.3 Confirmação de exclusão + undo (anti m4)
- [x] **Remover sempre exige undo.** `onRemove` → optimistic update → `toast` com `ToastAction "Desfazer"` (5s de janela) → chamada API só após timeout. Implementado em produção — preservar exatamente.
- [x] **Sem exclusão silenciosa.** Nenhum botão de delete chama API diretamente sem este padrão.

### 6.4 Toast em toda ação (anti m5)
- [x] **Toda mutação emite toast.** Lista de ações obrigatórias com toast:
  - Adicionar ao caderno → "Salvo no Caderno · Q{n} · {Área}"
  - Marcar como dominada → "Marcado como dominado"
  - Reabrir (desmarcar dominada) → "Reaberto"
  - Snooze/agendar → "Volta em {N} dias"
  - Remover → "Item removido" + ToastAction "Desfazer"
  - Erro de rede → toast `variant="destructive"` com descrição e retry

### 6.5 Nomenclatura única de filtros (anti m6)
- [x] **Labels fixos em todas as abas:**
  - Faixa de tipo: "Causa" (não "Categorias", "Focos" ou "Tipos")
  - Faixa de especialidade: "Área"
  - Input de texto: "Buscar" (placeholder: "Questão, área ou simulado…")
- [x] **Mesmos labels no `aria-label` dos radiogroups.**

### 6.6 Estado ativo sempre visível nos filtros (anti m2)
- [x] **FilterChip** usa `aria-checked={active}` + mudança de cor explícita (background + border + check icon) quando ativo.
- [x] **Filtro limpo** retorna os chips ao estado inativo visivelmente — sem ambiguidade.
- [x] **Filtro com resultado zero** mostra mensagem + "Limpar filtros" — nunca estado vazio silencioso.

### 6.7 Preview expansível (anti — card truncado da Medway)
- [x] **Linha 3 do card** exibe 2 linhas do enunciado com `line-clamp-2`.
- [x] **Botão "ver mais"** expande o enunciado inline (sem modal) com `AnimatePresence`.
- [x] **Colapsar** retorna ao estado compacto.

### 6.8 Skeleton em todo carregamento (anti m14)
- [x] **`CadernoSkeleton`** exibido durante fetch inicial (hero + chips + cards).
- [x] **`NotebookEntryCardSkeleton`** para cards individuais durante refresh.
- [x] **Sem texto "Carregando…"** sozinho sem indicador visual.

### 6.9 Tooltip e label em ícones (anti m13)
- [x] **Todo botão de ícone** (Trash2, Check, Clock, Play, RefreshCw) envolto em `<Tooltip>` shadcn com `TooltipContent` descritivo.
- [x] **Atalhos de teclado** exibidos no tooltip: `Desfazer (Ctrl+Z)`, `Anterior (←)`, `Próxima (→)`.

### 6.10 Dica de Esc no modal (anti m13)
- [x] **`AddToNotebookModal`** exibe no footer: `Esc para fechar` (texto ou ícone de teclado `kbd`).
- [x] `useEffect` de `keydown` para `Escape` já existe no sandbox — preservar na versão de produção.

### 6.11 Paginação / contagem (anti m11)
- [x] **Cada seção da fila** exibe contagem: "Devidas hoje (6)" no cabeçalho.
- [x] **Total** exibido no hero: "47 questões · 4 especialidades".
- [x] **Ordem** informada no header da seção (sem necessidade de dropdown de ordenação na Fase 1).

---

## Premissas que outras specs devem honrar

### Nomes de rotas canônicos
```
/caderno              ← página principal (gate PRO)
/caderno/revisao      ← sessão de revisão sequencial
/caderno/favoritos    ← Fase 2
/caderno/anotacoes    ← Fase 2
/caderno/flashcards   ← Fase 2
/caderno/insights     ← Fase 2
```

### Nomes de componentes canônicos
```
CadernoPage                             src/pages/CadernoPage.tsx
CadernoRevisaoPage                      src/pages/CadernoRevisaoPage.tsx  (mantido)
NotebookEntryCard                       src/components/caderno/NotebookEntryCard.tsx
PageHero (caderno)                      src/components/caderno/PageHero.tsx
HeroNextCard (caderno)                  src/components/caderno/HeroNextCard.tsx
FilterBar (caderno)                     src/components/caderno/FilterBar.tsx
ZeroPendingState (caderno)              src/components/caderno/ZeroPendingState.tsx
CadernoSkeleton                         src/components/caderno/CadernoSkeleton.tsx
TabBar (caderno)                        src/components/caderno/TabBar.tsx
AddToNotebookModal                      src/components/AddToNotebookModal.tsx  (mantido)
```

### Nomes de abas (labels canônicos na UI)
```
Revisar · Favoritos · Anotações · Flashcards · Insights
```

### Fonte da verdade de tipos de erro
```
src/lib/errorNotebookReasons.ts   →   DbReason (valor salvo no banco)
                                  →   getReasonMeta(reason: DbReason): ReasonMeta
```
O `errorTypes.ts` do sandbox e o sistema de `LocalReason` do modal de produção são intermediários de exibição — ambos mapeiam para `DbReason` antes de persistir.

### Gate PRO
```tsx
// Padrão obrigatório em CadernoPage:
const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;
if (!hasAccess) return <ProGate feature="cadernoErros" ... />;
```
Nenhuma sub-rota de `/caderno` bypassa este gate.

### API de dados
```ts
simuladosApi.getErrorNotebook(userId)           // lista entries
simuladosApi.toggleResolvedEntry(id, userId, v) // dominar/reabrir
simuladosApi.deleteErrorNotebookEntry(id, userId) // remover (soft delete)
simuladosApi.snoozeErrorNotebookEntry(id, days)  // agendar revisão
simuladosApi.getErrorNotebookEntryForReview(id, userId) // sessão de revisão
simuladosApi.saveErrorNotebookAiReview(id, userId, data) // cache IA
```
Specs de Fase 2 (SRS, flashcards, insights) adicionam métodos novos — não modificam os listados acima.
