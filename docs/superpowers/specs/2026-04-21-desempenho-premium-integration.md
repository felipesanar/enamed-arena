# Desempenho — Reintegração Premium à Plataforma

**Data:** 2026-04-21
**Escopo:** Reescrita do `src/components/desempenho/DesempenhoSimuladoPanel.tsx` + ajustes finos em `src/pages/DesempenhoPage.tsx`
**Status:** Especificação + implementação.

---

## 1. Diagnóstico — o que está errado

Screenshot analisado: hero dark "Análise de Performance · Desempenho · 31/100" seguido de um bloco branco flutuante com cards de especialidade simples (Pediatria 7/17, Cirurgia 6/18 etc.).

1. **Dois títulos "Desempenho" na mesma tela.** A `DesempenhoPage` já renderiza `PageHeader` com `title="Desempenho"` e subtítulo. Logo abaixo, o `DesempenhoSimuladoPanel` renderiza outro "Desempenho" como H1 interno do hero. Redundância visual e de leitura de tela.
2. **Hero com gradient/paleta próprios,** diferente da `HomeHeroPerformanceCard` (que é o idioma do produto). A Home usa `148deg, #0C1220 → #11192A → #2E0C1E → #3F1028` com orbs atmosféricos e highlight superior. Aqui a tela usa `135deg, #421424 → hsl(340,58%,14%) → #0f111a` sem orbs, sem linha-luz, sem shadow premium. Não é a mesma família visual.
3. **Pílulas de simulados com `text-[10px]`** — ilegíveis. Chips "7/17 melhor espec." e "4/20 foco" com labels de `text-[7px]` (sete pixels) no fundo escuro — nível de micro-detalhe que some visualmente.
4. **"Prova Revisada PDF" escondido** num chip fantasma no canto do hero. Ação importante (exportar revisão) ganha tratamento de botão secundário fraco — deveria ser um CTA premium, não uma pílula grudada.
5. **Bloco body `bg-white px-5 py-6`** ocupando full-bleed logo abaixo do hero. Aparece como uma "tela branca" nascida do nada, sem radius, sem border, sem sombra. Visualmente desconectado da dashboard e do hero. Três camadas competindo: dashboard bg (`#f7f5f8`), hero dark arredondado, tela branca plana.
6. **AreaCards pobres:** card branco simples, título 11px, score `24px black`, barra 4px. Sem indicador de drill-down (seta, hover chevron), sem chip de aproveitamento %, sem hierarquia visual entre best/worst/normal — apenas troca a cor do número.
7. **Cores hardcoded:** `text-green-700`, `text-red-600`, `text-green-400`, `text-red-400`, `bg-green-200`, `bg-red-200`, `from-[#8e1f3d] to-[#e83862]`, `bg-[#fafafa]`, `#421424`. Zero uso dos tokens `text-success`, `text-destructive`, `bg-primary`, `bg-wine`.
8. **Tipografia em pixel cru:** `text-[9px]`, `text-[11px]`, `text-[14px]`, `text-[22px]`, `text-[40px]` com `tracking-[1.5px]`, `tracking-[1.2px]`, `tracking-[-2px]` — nenhuma classe do design system (`text-heading-1`, `text-overline`, `text-caption`, `text-kpi`).
9. **Aninhamento de paddings:** o `DashboardLayout` já aplica `px-4 md:px-8 py-6 md:py-8`; a `DesempenhoPage` ainda adiciona `px-4 md:px-8 pt-6 md:pt-8` em torno do `PageHeader`; o `DesempenhoSimuladoPanel` aplica `p-2 md:p-3` (motion wrapper) + `px-5 py-6` no hero + `px-5 py-6 md:px-6 md:py-7` no body branco. Três camadas de padding somadas produzem respiros inconsistentes entre as seções.
10. **Sem PageTransition e stagger do produto.** Outras páginas premium abrem com `StaggerContainer` + `StaggerItem` (cadência 0.06s). Aqui, apenas um `motion.div` inicial do wrapper.
11. **Breadcrumb com `text-[11px]`** quebrando a escala tipográfica (deveria ser `text-caption`).
12. **SummarySection (`Onde brilha` / `Próximo foco`)** usa `bg-success/[0.03]` e `bg-destructive/[0.03]` com `border-*/20` — ok em teoria, mas dentro do bloco branco. Resultado: cards muito fracos contra o fundo branco achatado.
13. **EvoBars** funcionam, mas presos no mesmo bloco branco sem separador premium — ficam como um pós-escripto visual.
14. **Mobile:** `31/100` + chips "melhor/foco" apertados na mesma linha (`flex items-end justify-between`), quebra em telas < 380px. Pílulas de simulados em scroll mas `text-[10px]` impraticáveis em mobile.
15. **Acessibilidade:**
    - Barras de progresso sem `role="progressbar"` / `aria-valuenow/max`.
    - Drill-down cards sem `aria-label` descritivo nem indicação visual de affordance (chevron/→).
    - Accordions sem `aria-expanded`.
    - Focus rings inconsistentes (alguns botões sem `focus-visible:ring`).

---

## 2. Estratégia de redesign

Mesmo princípio aplicado no Caderno de Erros: reintegração ao design system e ao idioma visual do produto (Home, Simulados, Caderno).

### Anatomia alvo

```
DesempenhoPage
├── PageTransition
│   ├── PageHeader (título/subtítulo/badge + action slot com botão PDF)
│   ├── SimuladoTabs (pílulas premium — só se > 1 simulado com resultado)
│   ├── PerformanceHeroCard   ← dark premium, idêntico família HomeHero
│   │   ├── Eyebrow + score 31/100 + % aproveitamento + progress bar
│   │   └── Mini-stats "Melhor" / "Foco"
│   ├── Breadcrumb (quando há drill-down)
│   ├── SpecialtyGrid  → SubspecialtyGrid → ThemeAccordion (drill-down)
│   ├── SummarySection (Onde você brilha / Próximo foco)
│   └── EvoBarsSection (Evolução por especialidade)
```

### Princípios

1. **Um único H1.** `PageHeader` externo fica. Remover o H1 interno do hero — substituir por um eyebrow ("Aproveitamento geral") e um display numérico.
2. **Hero dark alinhado ao idioma premium.** Mesma família de gradient/orbs/shadow da `HomeHeroPerformanceCard`:
   - `bg-[linear-gradient(148deg,#0C1220_0%,#11192A_38%,#2E0C1E_72%,#3F1028_100%)]`
   - Orbs atmosféricos (wine glow + dark orb) e highlight no topo.
   - `border-white/[0.07]`, `rounded-[22px]`, `shadow-[0_20px_40px_-20px_rgba(10,14,26,0.85),0_8px_20px_-12px_rgba(60,12,32,0.45)]`.
3. **Score como protagonista.** Display `text-5xl font-extrabold` com `tabular-nums` + barra de progresso premium (mesma construção do Caderno: `bg-white/[0.08]` track + fill gradient `#8E1F3D → #E83862`).
4. **Mini-stats "Melhor" / "Foco" legíveis.** Trocar `text-[14px]`/`text-[7px]` por `text-heading-3`/`text-overline`. Badge colorido (success/destructive com opacidade 0.12 + border 0.25) — dialogando com os tokens do sistema via cores `text-emerald-300`/`text-rose-300` sobre o fundo escuro (mesma abordagem da HomeHeroPerformanceCard que já mistura `text-emerald-400` com primary).
5. **CTA "Prova Revisada PDF" como botão secundário premium.** Sai do hero e vai para o `action` slot do `PageHeader` (onde o padrão do produto posiciona ações de página). Quando em mobile: cai para baixo do badge, full-width.
6. **Remover o bloco `bg-white` full-bleed.** Cada seção (Breadcrumb, Grid de áreas, Summary, Evo) vira um bloco independente em cima do background da dashboard, com respiro entre si (`space-y-6`). Onde for preciso card, usar `.premium-card` / `bg-card`.
7. **AreaCard premium** (usado nas 3 camadas — Especialidade, Subespecialidade, Tema):
   - `.premium-card-interactive` (border, shadow, hover translate -1px).
   - Top: nome da área truncado + chevron sutil à direita (`ChevronRight` em `text-muted-foreground/40`, ganha `text-primary` em hover).
   - Middle: score `text-kpi-sm` tabular-nums + chip de aproveitamento `X%` à direita (cor por tier: success ≥ 70, warning 50–70, destructive < 50).
   - Barra 6px rounded com gradient wine por padrão; success quando é best; destructive quando é worst.
   - Footer: `{N} questões` em `text-caption text-muted-foreground`.
   - Estados: `isBest` ganha border `border-success/30` + shadow leve success. `isWorst` ganha border `border-destructive/30` + shadow leve destructive. Normal = `border-border`.
   - Grid: 2 colunas em mobile, 3 em md, 4 em lg.
8. **Breadcrumb** com tokens (`text-caption text-muted-foreground`), ChevronRight `h-3 w-3 opacity-40`, item ativo em `text-foreground font-semibold`.
9. **ThemeAccordionRow:**
   - Header com `ChevronRight` rotacionado quando open (`rotate-90`), `aria-expanded`.
   - Score % colorido por tier usando tokens (`text-success`/`text-warning`/`text-destructive`).
   - Conteúdo expansível em `bg-muted/30` com lista de questões em linhas com `Link` hover refinado.
   - Badges por questão: `Acerto` em `bg-success/10 text-success`, `Erro` em `bg-destructive/10 text-destructive`, `Em branco` em `bg-warning/15 text-warning-foreground`.
10. **SummarySection — cards premium** (`.premium-card` base). Lado success com ícone `Star`, lado destructive com `TrendingDown`. Paleta pelos tokens.
11. **EvoBarsSection — refinamento:** barra 7px com track `bg-muted` e fill gradient wine. Linha mestre por área em `text-body-sm text-foreground`, pontuação tabular-nums.
12. **Animações:** `StaggerContainer`/`StaggerItem` envolvendo as seções principais. `AnimatePresence` preservado nos drill-downs. `useReducedMotion()` respeitado em toda a barra/stagger.
13. **Acessibilidade:**
    - `role="progressbar"` com `aria-valuenow`/`aria-valuemax`/`aria-label` em todas as barras.
    - Área cards com `aria-label="{área}: {correct} de {questions} acertos ({score}%)"`.
    - Accordion com `aria-expanded`, `aria-controls`.
    - Focus rings premium (`focus-visible:ring-2 ring-ring ring-offset-2`).
14. **Mobile-first:** pílulas de simulados `text-[12px]` com scroll horizontal, score em `text-4xl sm:text-5xl`, stats em duas colunas embaixo do score em mobile e ao lado em desktop, CTA PDF full-width em mobile.

### Tokens utilizados

- Superfícies: `bg-background`, `bg-card`, `bg-muted`, `bg-accent`.
- Hero dark: paleta atmosférica + white overlays (`white/[0.04]`, `white/[0.08]`, `white/[0.12]`).
- Texto: `text-foreground`, `text-muted-foreground`, `text-primary`.
- Bordas: `border-border`, `border-primary/20`, `border-success/25`, `border-destructive/25`.
- Estados: `text-success`, `bg-success/10`, `text-destructive`, `bg-destructive/10`, `text-warning`.
- Tipografia: `text-heading-1`, `text-heading-2`, `text-heading-3`, `text-body`, `text-body-sm`, `text-caption`, `text-overline`, `text-kpi`, `text-kpi-sm`.

---

## 3. Preservações

- Drill-down 3 níveis (Especialidade → Subespecialidade → Tema → Questões) ✓
- Select de simulado com reset dos níveis ao trocar ✓
- `usePdfDownload` + stages (`preparing`, `loading_images`, `generating`, `complete`) ✓
- `correcaoVariant` (public/admin) para roteamento da correção ✓
- `PerformanceBreakdown` e props atuais mantidos ✓
- Ícones `Star`, `TrendingDown`, `Stethoscope` preservados ✓

---

## 4. Verificação

- `tsc --noEmit` limpo no arquivo alterado.
- `eslint` limpo.
- Build Vite processa o módulo.
- Visualmente: zero `#421424`, `text-green-400`, `bg-[#fafafa]`, tamanhos em pixel cru. 100% tokens do sistema ou, no hero dark, cores atmosféricas da mesma família da HomeHero.
- Testes (`DesempenhoPage.test.tsx`) **já estavam 100% quebrados antes da mudança** (`useUser must be used within a UserProvider` — o mock de `UserContext` está ausente; asserts citam componentes que não existem mais como `SimuladoResultNav` e textos como "Selecione uma Grande Área"). Fora do escopo desta iteração cirúrgica de UI.

---

## 5. Fora de escopo

- Recuperar testes legados (exigem novo `UserProvider` mock e assertions alinhadas à UI atual).
- Expansão do CTA PDF para oferecer mais variantes (Gabarito, etc.) — hoje o painel expõe só `downloadProvaRevisada`.
- Filtros adicionais por dificuldade/tipo dentro do drill-down.
