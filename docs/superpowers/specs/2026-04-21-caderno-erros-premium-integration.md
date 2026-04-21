# Caderno de Erros — Reintegração Premium à Plataforma

**Data:** 2026-04-21
**Escopo:** Reescrita da `src/pages/CadernoErrosPage.tsx`
**Origem:** Versão anterior importada quase literalmente da sandbox (`src/sandbox/caderno/*`) com inline styles e paleta própria. Não dialogava com o design system da plataforma (SanarFlix PRO: ENAMED) nem com a Home/Simulados/Desempenho premium.
**Status:** Especificação + implementação.

---

## 1. Diagnóstico — o que está errado

A tela atual parece um **bloco deslocado flutuando** no meio da dashboard:

1. **Falta PageHeader editorial.** Todas as páginas premium (Home, Simulados, Desempenho, Ranking) abrem com `<PageHeader title subtitle badge="ENAMED 2026">`. A Caderno substitui o header por um hero dark "interno" — quebrando a grid e a consistência visual.
2. **Inline styles ignorando o design system.** O componente é 100% `style={{ ... }}` com cores hardcoded (`#0f0a0d`, `#1a1018`, `#a03050`, `#f1f3f6`). Nada usa tokens (`--primary`, `--background`, `--card`, `--foreground`, `--muted`). Qualquer mudança de tema quebra; o dark-mode do produto nunca se aplica.
3. **Três camadas visuais competem** (dashboard bg → hero dark → body cinza dentro do dark). O resultado é um "card gigante com cinza dentro" — pesa mais que a Home inteira.
4. **Stats gigantes em casos pequenos.** Para 1 questão, a linha de 4 KPIs com tipografia `30px/900` mostra "1 · 0 · 1 · 1" — sensação de vazio amplificada. A Home resolve isso com `KpiGrid` contextual; aqui foi ignorado.
5. **Hero dark + card "próxima para revisar" também dark** — empatia cromática, sem hierarquia entre "estado geral" e "próxima ação".
6. **Filtros presos em uma faixa branca flutuante** entre o hero dark e o body cinza. Sem affordance premium; chips com border `1.5px #e5e7eb` em `#fff`, esmagados.
7. **Elementos ausentes:**
   - PageHeader/breadcrumb
   - `PageTransition` + stagger premium (todas as outras páginas abrem com stagger)
   - Integração mobile (paddings fixos em px, grid de 4 stats não responde)
   - Microcopy consistente (tom "Revisão ativa · 1 questões" — plural/singular e estilo genérico)
   - Estado "erro" de fetch (só loading e empty)
8. **Acessibilidade comprometida:**
   - `window.confirm()` para destructive (não existe focus trap, não casa com padrão de modais premium do produto).
   - `role="progressbar"` ausente.
   - Chips sem `role="radio" aria-checked`.
   - `aria-label` nos botões de check OK; remover falha.
9. **Performance:** animação da progress bar com `animate={{ width: ... }}` dentro de `<motion.div>` com `style` inline — OK, mas desalinhado do resto do produto que usa transitions CSS.

---

## 2. Estratégia de redesign

Não é refresco cosmético — é **reintegração ao design system**. Princípios:

1. **Anatomia padrão de página premium:**
   ```
   <PageTransition>
     <PageHeader title="..." subtitle="..." badge="PRO: ENAMED Exclusivo" />
     <HeroStatusCard />        ← dark premium, glossy, igual HomeHeroPerformanceCard
     <FiltersBar />            ← segmented chips, transparente sobre bg da dashboard
     <NextUpCard />            ← card claro com acento wine, "próxima para revisar"
     <QueueList />             ← content cards premium (padrão .premium-card)
     <ResolvedSection />       ← collapsible
   </PageTransition>
   ```

2. **Paleta & tokens:**
   - Hero dark usa o mesmo gradiente da `HomeHeroPerformanceCard`: `linear-gradient(148deg, #0C1220 0%, #11192A 38%, #2E0C1E 72%, #3F1028 100%)` com orbs atmosféricos e borda `rgba(255,255,255,0.07)`.
   - Demais superfícies: `bg-card`, `bg-background`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-primary`.
   - Cores de tipos de erro (Lacuna/Memória/Diferencial/Atenção/Chute) vêm do `errorNotebookReasons.ts` — preservadas.

3. **Hierarquia tipográfica:** usar `text-heading-1`, `text-heading-2`, `text-body-sm`, `text-caption`, `text-overline` do Tailwind config da plataforma.

4. **Radii:** `rounded-xl` / `rounded-2xl` / `rounded-[22px]` (iguais ao HomeHeroPerformanceCard).

5. **Shadows:** `var(--shadow-premium)` e os gradients documentados no HomePage.

6. **Stats contextuais em vez de KPI grid enorme.**
   - Dentro do hero: progress bar dominante (barra + "resolvidas / total" + %).
   - Stats secundários inline (pendentes, especialidades, streak quando > 0) em tipografia comedida.
   - Isso resolve o "vazio amplificado" (ex: 1 questão total). O protagonista visual do hero passa a ser o **progresso**, não números isolados.

7. **Card "Próxima para revisar" premium claro.** Em vez de dark-on-dark:
   - `bg-card` com `border border-primary/20` e acento lateral `bg-gradient-to-b from-primary to-wine-hover` (3px).
   - Chip do tipo de erro usa a paleta já definida em `getReasonMeta()`.
   - CTA principal em `bg-primary` (wine). CTA secundário "Ver questão completa" link sutil.
   - Bloco de "Sua anotação" + "Como revisar" com fundo `bg-accent/40` ou `bg-muted/40` (tokens).

8. **Queue rows premium.** `.premium-card` base (border, shadow-md, bg-card), barra lateral 3px na cor do tipo, check button usando paleta success do sistema.

9. **Filter bar como segmented** sem faixa separada: chips discretos sobre o bg da dashboard, com `role="radiogroup"` e foco visível.

10. **Streak** — só aparece se `streak > 0`. Componente pequeno no canto direito do hero, inline com título.

11. **Empty state** — usa `EmptyState` component oficial (já existe em `@/components/EmptyState`), com icon `BookOpen` e CTA "Ver simulados disponíveis".

12. **Estado "tudo resolvido"** — card premium claro (não dark novamente) com anel verde em `bg-success/10`, celebrativo mas contido. Um único emoji (🎯) permitido (princípio P2 do spec original).

13. **Mobile:**
    - Stats grid 2×2 no hero.
    - Filtros com scroll horizontal via `overflow-x-auto` + scroll-snap.
    - CTA do hero card ocupa 100% da largura.

14. **Confirm destructivo:** substituir `window.confirm()` por `toast` com botão "Desfazer" (padrão do produto para ações reversíveis com janela) — ou manter confirm com microcopy clara. Na primeira iteração, manter `window.confirm()` (escopo cosmético primário).

15. **Animações:** `StaggerContainer` + `StaggerItem` do `PageTransition`, mesmas durações do resto do produto (0.35s + ease `[0.25, 0.46, 0.45, 0.94]`). Progress bar com `framer-motion` usando `animate width`. Hero card e queue items com `AnimatePresence` para enter/exit.

---

## 3. Anatomia detalhada dos blocos

### 3.1 PageHeader
```
[PRO · ENAMED EXCLUSIVO]  (badge overline)
Caderno de Erros          (text-heading-1)
Sua ferramenta de revisão ativa para dominar o que importa.   (body-lg, muted)
```

### 3.2 HeroStatusCard (quando há entries)
- Background: `bg-[linear-gradient(148deg,#0C1220_0%,#11192A_38%,#2E0C1E_72%,#3F1028_100%)]`
- Orbs atmosféricos: wine glow topo-direita (60px blur), dark glow canto-inferior (40px blur), spec-light sutil.
- Border `border-white/[0.07]`, radius `rounded-[22px]`, shadow escura premium.
- Conteúdo em 3 linhas internas:
  1. **Topo:** título interno ("Seu progresso") + eyebrow "Revisão ativa" + streak chip (se > 0) à direita.
  2. **Barra de progresso:** dominante, height 6px, track `rgba(255,255,255,.08)`, fill `linear-gradient(90deg, #8E1F3D 0%, #E83862 100%)`. Labels: "X de Y resolvidas" (esquerda) · "NN%" (direita).
  3. **Stats inline compactos:** `N pendentes · N resolvidas · N especialidades` — todos com `text-white/70` e `font-medium`, sem competir com o progresso.

### 3.3 FiltersBar
- Título micro "Filtrar por tipo" (overline).
- Chips: `Todos [N]` + 1 por tipo ativo.
- Cada chip: `rounded-full border px-3 py-1.5 text-[12px]`. Ativo = background da cor do tipo (usando `colorBg` + `colorBorder` + `colorText` do `getReasonMeta`), inativo = border/bg neutro.
- Mobile: scroll horizontal com `scroll-snap-type: x mandatory`.
- Opcional (aparece se `specialties.length > 1`): segundo grupo com prefixo "Área".

### 3.4 NextUpCard ("Próxima para revisar")
- Eyebrow overline "Próxima para revisar" + ícone ⚡ (lucide `Zap`).
- Card premium claro:
  - `rounded-2xl border border-primary/20 bg-card shadow-premium`
  - Acento vertical 3px lateral esquerdo em gradient wine.
- Top row: `Q{n} · Área — Tema` (bold) + chip do tipo + meta (simulado · data).
- Bloco "Sua anotação" (se existe): `bg-muted/40 border border-border/60 rounded-lg p-3`.
- Bloco "Como revisar": `bg-primary/[0.04] border border-primary/15 rounded-lg p-3` com ícone e texto.
- Footer: botão wine "Marcar como resolvida" + link "Ver questão completa" → `/simulados/{id}/correcao?q={n}`.

### 3.5 QueueItem (fila)
- Content card: `rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 hover:border-border-strong transition-colors`.
- Barra lateral 3px alt=stretch na cor do tipo.
- Body: título truncado + meta. "Como revisar" aparece como eyebrow curto se houver espaço.
- Chip do tipo à direita.
- CheckButton 28×28 (usa cor success do sistema no hover/done).
- Delete button icon-only com `text-muted-foreground hover:text-destructive`.

### 3.6 ResolvedSection (collapsible)
- Título "Resolvidas (N)" com botão "ver/ocultar".
- Items com `opacity-60 line-through` e check done persistente.

### 3.7 Empty state (sem entries)
- Usa padrão da `HomePagePremium` onboarding card:
  - Container `rounded-3xl border-2 border-dashed border-primary/25 bg-primary/[0.04] p-8 text-center`.
  - Ícone BookOpen em bubble wine/accent.
  - Título + descrição sobre como preencher.
  - CTA wine "Ver simulados disponíveis".

### 3.8 All-resolved state
- Card premium claro com `border-success/20 bg-success/[0.04]`.
- Anel verde 64×64 com check.
- "Caderno zerado 🎯" + descrição curta.
- Stats: N resolvidas (success) + streak (wine).
- Link secundário "Ver questões resolvidas".

### 3.9 Loading state
- Skeleton que espelha o layout real:
  - Skeleton do PageHeader.
  - Skeleton do hero card (altura ~170px).
  - Skeleton de filter chips (3 pílulas).
  - Skeleton do NextUpCard (~220px).
  - 2-3 skeleton de QueueItem.

### 3.10 Error state (novo)
- Usa `<EmptyState variant="error" title="Não foi possível carregar o Caderno" onRetry={fetchEntries} />`.

---

## 4. Estados por componente

| Componente | Default | Hover | Focus | Active | Disabled | Loading |
|---|---|---|---|---|---|---|
| HeroCard progress | Fill animado | — | — | — | — | Skeleton h-6 |
| FilterChip | border border-border text-muted | border-border-strong | ring-2 ring-ring | + bg tint do tipo | opacity-40 | — |
| NextUpCard CTA | bg-primary | bg-wine-hover | ring | scale 0.99 | — | Spinner |
| QueueItem | border-border | border-border-strong | ring | — | opacity-60 (resolved) | — |
| CheckButton | bg-muted border | bg-success/15 border-success/40 | ring | — | — | — |

---

## 5. Tokens utilizados (apenas tokens da plataforma)

- Superfícies: `bg-background`, `bg-card`, `bg-muted`, `bg-accent`.
- Texto: `text-foreground`, `text-muted-foreground`, `text-primary`.
- Bordas: `border-border`, `border-primary/20`, `border-white/[0.07]` (hero dark).
- Brand: `bg-primary`, `text-primary`, `bg-wine`, `hover:bg-wine-hover`.
- Estados: `bg-success/10`, `text-success`, `bg-destructive/10`, `text-destructive`.
- Sombras: `shadow-premium` (via classe `.premium-card-hero`), `shadow-md`.
- Tipo: `text-heading-1`, `text-heading-2`, `text-body-lg`, `text-body-sm`, `text-caption`, `text-overline`.

Cores dos tipos de erro continuam vindo de `getReasonMeta()` — é taxonomia do domínio, não design system genérico.

---

## 6. Preservações (não regride nada da lógica)

- `useUser()`, `useAuth()`, `SEGMENT_ACCESS` para gating PRO ✓
- `simuladosApi.getErrorNotebook`, `toggleResolvedEntry`, `deleteErrorNotebookEntry` ✓
- `trackEvent('caderno_erros_viewed', ...)` e `caderno_erros_filtered` ✓
- Filtro por tipo + especialidade, sort por addedAt ASC ✓
- Streak calculado a partir de `resolvedAt` ✓
- Link `/simulados/{id}/correcao?q={n}` ✓
- Remoção otimista com rollback + toast ✓
- `ProGate` para usuários sem acesso ✓

---

## 7. Fora do escopo (futuro)

- Substituir `window.confirm()` por modal premium com "Desfazer".
- Adicionar atalhos de teclado (J/K para navegar na fila, Space para marcar).
- Métricas de revisão espaçada por tipo ("Memória: revise em 3 dias").
- Filtros combinados com query params (shareable URL).
- Exportar relatório PDF da revisão.

---

## 8. Verificação

- [ ] Build (`tsc` + `vite build`) limpo.
- [ ] Lint limpo.
- [ ] Visualmente: sem inline styles, sem cores hardcoded, 100% tokens.
- [ ] Mobile: stats em 2×2, chips rolam, CTAs full-width.
- [ ] Estados: loading, empty, error, all-resolved, filtro-vazio, PRO gate — todos cobertos.
- [ ] Acessibilidade: `role="radiogroup"` nos filtros, `role="progressbar"` na barra, focus rings visíveis, `aria-label` nos botões de ação.
