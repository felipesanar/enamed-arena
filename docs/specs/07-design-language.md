# 07 — Design Language do Caderno de Erros v2 (contrato de UI)

> Fonte da verdade visual. Toda superfície do caderno (desktop e mobile) deve consumir estes tokens e primitivos. Em conflito, vale este doc. Direção: **Elevar o wine** + **Clínico premium**.

## 0. Princípios
1. **Cor = significado.** Cor cheia só para causa-do-erro e estados; o resto é neutro quente. Nada de cor decorativa.
2. **Calma e respiro.** Espaço em branco generoso, hierarquia tipográfica forte, 1 ação primária por tela.
3. **Profundidade sutil.** Eleva­ção por sombra suave + glass leve; nunca pesado.
4. **Plataforma é experiência, não breakpoint.** Desktop = multi-painel, hover, teclado, densidade. Mobile = coluna única, bottom sheet, bottom nav, polegar, swipe, alvos ≥44px.
5. **Movimento discreto.** 150–320ms, mola sutil; respeitar `prefers-reduced-motion`.

## 1. Cor (tokens — definir em CSS vars; light + dark)

**Marca wine (bordô):**
```
--wine-50  #FBF1F4   --wine-300 #E29AAE   --wine-600 #9B2645
--wine-100 #F7E2E8   --wine-400 #CF5C7C   --wine-700 #7A1A32
--wine-200 #EFC3CF   --wine-500 #B0294A*  --wine-800 #5C1426
                      (*primary ≈ marca)   --wine-900 #3E0E1A
GRADIENTE de marca: linear-gradient(135deg, #B0294A, #7A1A32)
```
Primary = `--wine-500/600`. CTAs primários usam o gradiente.

**Neutros quentes (light):**
```
--bg        #FAF8F7   (off-white quente)
--surface   #FFFFFF
--surface-2 #F6F2F1
--border    #ECE5E3
--ink       #1A1518   (texto forte, levemente quente)
--muted     #6E6469   (texto secundário)
--muted-2   #A89DA1
```

**Dark premium (ink):**
```
--bg        #0F0D11   --surface   #16131A   --surface-2 #1E1A24
--border    #2A2531   --ink       #F4EFF2   --muted     #A89FB0
GLOW wine (dark): radial-gradient(circle, rgba(176,41,74,.22), transparent 70%)
```

**Semântica de causa do erro (FIXAS — alinhar com `errorNotebookReasons.ts`):**
```
Lacuna  (did_not_know)        rose   #F43F5E
Memória (did_not_remember)    violet #8B5CF6
Atenção (reading_error)       amber  #F59E0B
Diferencial(confused_alt)     blue   #3B82F6
Chute   (guessed_correctly)   yellow #EAB308
(legado did_not_understand)   gray   #6B7280
```
Cada causa tem: `base`, `bg` (tint ~12%), `border` (~24%), `text` (escuro). Usar barra/badge na cor da causa.

**Estados:** success `#16A34A` · warning `#F59E0B` · info `#3B82F6` · destructive `#DC2626`.

## 2. Tipografia
Plus Jakarta Sans. Manter os tamanhos custom do projeto (`text-kpi/display/heading-1..3/body/overline/caption/micro-label`). Pesos: 800 títulos, 700 destaques, 500 corpo. `letter-spacing` -0.02em em títulos grandes; overline uppercase +0.1em.

## 3. Forma, elevação, vidro
```
--radius-card 20px   --radius-control 12px   --radius-pill 999px
--shadow-sm  0 1px 2px rgba(20,12,16,.05), 0 2px 8px -4px rgba(20,12,16,.08)
--shadow-md  0 8px 30px -12px rgba(20,12,16,.18)
--shadow-glow 0 8px 40px -12px rgba(176,41,74,.35)   (dark/CTA)
GLASS  bg surface @ 72% + backdrop-blur(16px) + border 1px @ alpha
```
Cards: `--radius-card`, `--shadow-sm`, hover → `--shadow-md` + translateY(-2px) (desktop).

## 4. Movimento
Durations 150/220/320ms. Ease padrão `cubic-bezier(0.22,1,0.36,1)`; mola para entrada `cubic-bezier(0.34,1.56,0.64,1)`. Stagger 30–40ms em listas. Tudo suprimido com `prefers-reduced-motion`.

## 5. Arquétipos de layout

**Desktop (≥1024px):** dentro do `DashboardLayout`. PageHeader premium (título + stats em tiles + ação primária à direita). `TabBar` horizontal sticky. Conteúdo em **multi-painel** quando útil: lista + painel de contexto à direita (ex.: revisão = questão + fila; insights = grid 2-col; flashcards = grid). Hover states, atalhos de teclado, densidade maior, larguras máx ~1120px centralizadas.

**Mobile (<768px):** **App bar** compacta sticky (título + 1 ação/voltar). Tabs como **segmented control** scrollável horizontal logo abaixo. Conteúdo **1 coluna**, cards confortáveis (padding maior, alvos ≥44px). Modais → **bottom sheet** (Drawer). Ação primária em **barra inferior sticky** (acima do bottom-nav global) ou FAB no thumb-zone. **Swipe**: entrada (→ resolver, ← adiar); flashcard (flip/tap). Sem hover; foco visível.

**Tablet (768–1023px):** trata como desktop simplificado (1–2 colunas).

Hook de plataforma: usar/criar `useIsMobile()` (breakpoint 768) para escolher árvore desktop × mobile onde a UX difere de verdade (não só CSS). Onde a diferença é só layout, usar classes responsivas Tailwind.

## 6. Inventário de primitivos (em `src/components/caderno/ui/`)
- `CadernoCard` — card base (radius/shadow/hover), variante `interactive`.
- `CauseBar` / `CauseBadge` — barra/badge na cor da causa do erro (lê `getReasonMeta`).
- `FilterChip` — chip de filtro (estado ativo SEMPRE visível: cor+borda+check).
- `StatTile` — número grande + label overline + cor opcional.
- `ProgressRing` e `ProgressBar` (gradiente wine).
- `SectionHeader` — título + contagem + ação.
- `AdaptiveModal` — `Dialog` no desktop, `Drawer`/bottom-sheet no mobile (mesma API).
- `MobileAppBar`, `BottomActionBar` (sticky thumb-zone), `SegmentedTabs`.
- `CadernoEmptyState`, `CadernoSkeleton`.
- `KpiHero` / `PageHeaderPremium`.
Todos PT-BR, a11y (foco, aria, contraste AA), dark-mode-ready.

## 7. Estados obrigatórios por tela
loading (skeleton) · vazio (ilustrado, CTA) · erro (retry) · sucesso (toast) · zero-pendentes (celebratório). Exclusão sempre confirmação+undo. Ícone sempre com label/tooltip.

## 8. Verificação visual
Rota dev-only `/sandbox/caderno-v3` (showcase) renderiza TODAS as superfícies redesenhadas com mock data, com toggle desktop/mobile e light/dark, para QA no browser sem auth.
