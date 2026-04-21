

# Auditoria mobile — visão geral e plano de correções

## Escopo
Revisão da adaptação mobile de **todas as superfícies do app**: shell (sidebar/bottom nav/header), Home, Simulados (lista/detalhe), Prova, Correção, Resultado, Desempenho, Ranking, Comparativo, Caderno de Erros, Configurações, Onboarding, Login, Landing e Admin Center.

## Achados por tela (severidade entre colchetes)

### 1) Shell mobile (Header + Bottom Nav) — `src/components/premium/Mobile*.tsx`
- **[OK]** Header fixo, bottom nav fixa, ambos com safe-area. Padding do `main` no `DashboardLayout` já compensa.
- **[Minor]** `MobileBottomNav` usa `min-h-[48px]` por item; toque ergonômico OK, mas o **rótulo "Erros"** abre direto enquanto **Ranking** abre sheet — incoerência percebida pelo usuário.
- **[Minor]** Header colapsa em scroll (50px); o badge "Completar perfil" some quando compacto (perdemos o atalho).

### 2) Home (`HomePagePremium`) — `src/components/premium/home/`
- **[Major]** O bloco `HeroPerformanceCard` (gradiente escuro com mini-chart) renderiza **lado a lado** apenas em `lg`. Em mobile (<768px), aparece **abaixo** do `KpiGridSection`, que é correto, mas o card tem `min-h` implícito grande e o mini-chart de 6 barras com `gap-1` fica apertado em telas <360px (bordas tocando).
- **[Minor]** "Seu caminho até aqui" exibe `text-[20px]/22px` heading + subtítulo + chart + helpers — é **denso** em viewport pequeno; falta `space-y` consistente no mobile.
- **[OK]** `NextSimuladoBanner` e `UpgradeBanner` são responsivos.

### 3) Simulados — `SimuladosPage`
- **[OK]** Layout single column. Hero + timeline empilham bem.
- **[Minor]** Cards da timeline com badge + data + CTA podem **quebrar em 2 linhas com overflow** quando título do simulado é longo (não tem `truncate`/`line-clamp-1`).

### 4) Detalhe do Simulado / Arena (`SimuladoDetailPage`)
- **[OK]** `SimuladoDetailPaddedShell` aplica padding de safe-area corretamente.
- **[Minor]** Checklist usa `grid-cols-1 sm:grid-cols-2`. Cada item tem ícone + 2 linhas; em <360px o texto fica colado no checkbox.

### 5) Prova (`SimuladoExamPage`)
- **[OK]** `MobileQuestionNav` fixed bottom com scroll horizontal; `min-w-[32px]`/`h-8` adequado.
- **[Major]** O **header de prova** (timer + ações) é desenhado para desktop. Em mobile o `ExamHeader` pode fazer wrap e empurrar o conteúdo. Confirmar `ExamHeader` mobile-first (verificar componente).
- **[Minor]** `QuestionDisplay` botão "eliminar" tem `min-h-[44px] min-w-[44px]` — OK. Mas o botão fica **sempre visível** em mobile (`opacity-100`) como deveria.

### 6) Correção (`CorrecaoPage`)
- **[OK]** Aside de navegação é `hidden md:flex`; mobile usa bottom-sheet com handle.
- **[Minor]** Comentário do professor com `EXPLANATION_MAX_H` + fade pode ficar muito alto quando há imagem grande logo abaixo.

### 7) Resultado (`ResultadoPage`)
- **[OK]** `grid-cols-3` para stat cards é apertado mas legível. `gap-1.5 sm:gap-2`.
- **[Minor]** Verificar se ações (PDF, voltar) ficam acessíveis sem overflow horizontal.

### 8) Desempenho (`DesempenhoPage` + `DesempenhoSimuladoPanel`)
- **[OK]** Seletor de simulado com `overflow-x-auto`.
- **[Major]** Hero do painel: o grid `md:grid-cols-[1fr_auto]` cai bem no mobile, mas o número da nota usa `text-[44px]` em mobile — **gigante demais** quando combinado com label e MiniStats logo abaixo. Causa scroll vertical e um "empurrão" do PDF button.
- **[Minor]** `MiniStat` tem `min-w-[120px]` num grid `grid-cols-2`. Em telas <360px estoura levemente o container.

### 9) Ranking (`RankingView`)
- **[Major]** Tabela esconde colunas Especialidade/Instituição em mobile (`hidden md:table-cell`) — **bom**. Mas o **layout do hero+KPI** (`md:grid md:grid-cols-2`) empilha em mobile, e os 2 KPIs ficam em `grid-cols-2 gap-2.5` com `min-height: 110px` — texto longo (ex.: "Ainda não passou"+helper italic) **estoura altura** e gera card desigual.
- **[Minor]** Filtros segmented (`<f.icon /> + <span hidden sm:inline>`) em mobile mostram só ícones — pode confundir; falta `aria-label` rico.

### 10) Comparativo (`ComparativoPage`)
- **[OK]** Grids `grid-cols-2 md:grid-cols-4` e `md:grid-cols-2`.
- **[Minor]** Gráfico Recharts (`ResponsiveContainer`) — verificar se `XAxis tick` não corta labels em telas <380px.

### 11) Caderno de Erros (`CadernoErrosPage`)
- **[OK]** Filtros chips com scroll horizontal, header com glassmorphism. Stats em `grid-cols-2 sm:grid-cols-3` com `col-span-2 sm:col-span-1` para 3º card — bem feito.
- **[Minor]** O footer de cada entry é `flex-col-reverse sm:flex-row`. CTA "Marcar como resolvida" tem `flex-1 sm:flex-none` — OK.

### 12) Configurações (`ConfiguracoesPage`)
- **[OK]** Após o refactor recente (abas + render condicional). Nav mobile como chips `lg:hidden sticky top-[60px]`.
- **[Major]** O **sticky top-[60px]** dos chips foi calibrado para a altura antiga do header. Hoje o `MobileDashboardHeader` mede ~56px expandido + safe-area, e ~50px compacto. **Os chips colam no topo errado** (gap visível ou sobreposição) dependendo do scroll.
- **[Minor]** O hero usa `md:px-8 py-8 md:py-10` — em mobile `px-6 py-8` ainda é generoso; OK.

### 13) Onboarding (`OnboardingPage`)
- **[OK]** Glass panel + steps com swipe gesture. Já documentado como mobile-first.
- **[Minor]** Confirmar `min-h-[100dvh]` no canvas para evitar gap quando a barra de URL do Safari mobile some/aparece.

### 14) Login / Auth (`LoginPage`)
- **[OK]** `mobileFooter`, `hidden md:block` para LogoPro. Bem responsivo.

### 15) Landing (`LandingExperience`, `LandingComparison`, `LandingExamDemo`)
- **[OK]** Grids responsivos, demo de prova esconde sidebar (`hidden md:flex`).
- **[Minor]** `LandingExamDemo` fixa altura/largura interna que pode estourar viewport <360px (verificar o container).

### 16) Admin Center (`/admin/*`)
- **[Major — bloqueador UX em mobile]** O **AdminLayout não usa** o `MobileDashboardHeader` nem o `MobileBottomNav` (eles são exclusivos do `DashboardLayout` do aluno). Se um admin abrir `/admin` no celular, fica sem navegação mobile decente — sidebar desktop "esmagada" ou off-canvas inexistente.
- **[Minor]** Tabelas de admin (`AdminDataTable`) sem `overflow-x-auto` claro em mobile — colunas com larguras fixas (`90px`, `80px`) podem estourar.

---

## Plano de correções (priorizado)

### P0 — Quick wins de alto impacto (esta entrega)

**A. Shell**
1. `MobileDashboardHeader.tsx` — exportar a altura real (`HEADER_H_EXPANDED=56`, `HEADER_H_COMPACT=50`) e expor via CSS var `--mobile-header-h`.
2. `SettingsNav.tsx` — usar `top-[calc(var(--mobile-header-h,56px)+env(safe-area-inset-top,0px)+8px)]` para o sticky de chips (corrige overlap em Configurações).
3. `MobileDashboardHeader.tsx` — manter "Completar perfil" visível mesmo no estado compacto (mover para a linha do logo como chip pequeno em vez de sumir).

**B. Home**
4. `HeroPerformanceCard` — em <380px reduzir `gap-1` para `gap-[3px]` no chart, e diminuir `text-[20px]→18px` do heading. Adicionar `space-y-3` interno.
5. `HomePagePremium` — wrapper externo: trocar `space-y-4 max-md:space-y-4 md:space-y-6` por `space-y-4 md:space-y-6` (redundante hoje) e garantir `min-w-0` no `lg:col-span-7` para evitar overflow do gradient card.

**C. Desempenho**
6. `DesempenhoSimuladoPanel` hero — escala da nota: `text-[36px] sm:text-[44px] md:text-[52px] lg:text-[56px]` (em vez de 44px direto no mobile).
7. `MiniStat` — remover `min-w-[120px]`; usar `min-w-0` para deixar o grid `grid-cols-2` controlar a largura.

**D. Ranking**
8. `RankingView` KPI cards — remover `minHeight: 110px` fixo; usar `min-height: clamp(96px, 26vw, 130px)` para não estourar altura desigual com texto longo.
9. Filtros segmented no mobile — adicionar `aria-label` no `<button>` (já tem `<span hidden sm:inline>` para o texto), sem mudar visual.

**E. Simulados**
10. `SimuladosTimelineSection` (cards) — adicionar `truncate`/`line-clamp-1` no título e `flex-wrap` controlado nos badges, evitando overflow horizontal.

**F. Caderno de Erros**
- (sem mudança — já está sólido após últimas iterações)

**G. Admin (apenas mitigação P0)**
11. `AdminLayout` — em mobile (<768px), exibir um aviso visual leve "Painel admin otimizado para desktop" (banner sticky topo) e garantir `overflow-x-auto` em todas as `AdminDataTable`s.

### P1 — Refinamentos (próxima entrega, fora deste escopo)
- Topbar admin mobile dedicada com drawer (sidebar off-canvas via `Sheet`).
- `ExamHeader` mobile-first review (timer compacto, ações em sheet).
- Auditar `LandingExamDemo` em viewport <360px.
- Padronizar `min-h-[100dvh]` em todas as páginas que usam `min-h-screen`.

---

## Arquivos afetados (P0)
- `src/components/premium/MobileDashboardHeader.tsx`
- `src/components/settings/SettingsNav.tsx`
- `src/components/premium/home/HomePagePremium.tsx`
- `src/components/desempenho/DesempenhoSimuladoPanel.tsx`
- `src/components/ranking/RankingView.tsx`
- `src/components/simulados/SimuladosTimelineSection.tsx`
- `src/admin/components/layout/AdminLayout.tsx` (banner mobile + overflow nas tabelas)
- `src/index.css` (CSS var `--mobile-header-h`)

## Risco / rollback
- Mudanças isoladas em CSS/Tailwind; sem mudança de schema, RPC, rota ou hook.
- Rollback simples por arquivo.

