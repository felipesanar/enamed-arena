# Auditoria e correções — Landing Plataforma de Simulados

## 1. O que foi auditado

### 1.1 Identidade visual / brand fit
- **Problema:** A landing usava paleta violeta/azul/ciano (#6b7fff, #8b5cf6, #a855f7, #22d3ee) e gradientes genéricos, alinhados a uma estética “Web3/AI”, não à marca SanarFlix Pro.
- **Conclusão:** Divergência total com o design system (wine/primary 345 65% 30%, wine-hover, wine-glow).

### 1.2 Design system / tokens
- **Problema:** Cores hardcoded em hex e rgba; sem uso de `--primary`, `--wine`, `--card`, `--border`, `--foreground`, `--muted-foreground`; sombras e radius inventados.
- **Conclusão:** Tokens do projeto (index.css + tailwind.config) existem e não eram usados na landing.

### 1.3 Componentização / reuso
- **Problema:** Links e CTAs feitos com `<Link>` + classes manuais; nenhum uso de `Button`; nenhum uso de `SectionHeader` ou padrões de seção do projeto.
- **Conclusão:** `Button` (e `buttonVariants`) e tipografia (text-heading-1, text-body, etc.) poderiam ser reutilizados.

### 1.4 Hierarquia visual
- **Problema:** Títulos com `font-bold text-white text-3xl` etc. em vez da escala tipográfica (text-display, text-heading-1, text-heading-2); subtextos com `text-white/65` em vez de `text-muted-foreground`.
- **Conclusão:** Hierarquia melhorável com a escala oficial (display, heading-1/2/3, body-lg, body, body-sm, caption, overline).

### 1.5 Layout / grid / espaçamento
- **Problema:** max-w-[1280px] e px-4 md:px-6 ok; algumas seções com mb-12 vs mb-14 inconsistentes; section padding py-24 md:py-32 mantido.
- **Conclusão:** Ajustes pontuais de consistência (mb-12 vs mb-14) e manutenção do container 1280px.

### 1.6 UX / legibilidade
- **Problema:** Conteúdo adequado ao produto; contraste em fundo escuro dependia de branco/cinza genéricos.
- **Conclusão:** Uso de `text-foreground` e `text-muted-foreground` (definidos no .dark) melhora contraste e consistência.

### 1.7 Motion / interações
- **Problema:** Durações e eases variados; referência usava [0.25, 0.46, 0.45, 0.94] em outros fluxos do projeto.
- **Conclusão:** Unificação com `MOTION_EASE = [0.25, 0.46, 0.45, 0.94]` e duração ~0.35–0.45s; stagger 0.04–0.06s; sem exagero.

### 1.8 Funcionamento
- **Problema:** Navbar sticky, scroll para âncoras e seção ativa já funcionavam; sem bugs de overflow ou clipping reportados.
- **Conclusão:** Mantido; apenas estilos e tokens alterados.

---

## 2. Principais problemas encontrados

| Área | Problema |
|------|----------|
| Cores | Violeta/azul/ciano em vez de primary/wine (SanarFlix Pro). |
| Tipografia | Font sizes e weights manuais em vez de text-display, text-heading-1, text-body, text-overline. |
| Tokens | Nenhum uso de border-border, bg-card, bg-primary, text-foreground, text-muted-foreground. |
| Componentes | CTAs e botões sem uso do `Button`; sem reuso de padrões de seção. |
| Fundo/glows | Gradientes e glows em roxo/azul; deveriam usar primary/wine-glow. |
| Motion | Ease e duração não alinhados ao padrão do projeto. |
| Aderência | Resultado parecia produto genérico, não ecossistema SanarFlix Pro. |

---

## 3. Principais correções implementadas

### 3.1 Tokens e tema
- **index.css:** Criadas variáveis `--landing-bg`, `--landing-bg-soft`, `--landing-surface`, `--landing-border`, `--landing-glow-*` (baseadas em 345 / wine) para uso opcional.
- **tailwind.config.ts:** Adicionada cor `landing.bg` (e variantes) apontando para essas variáveis.
- **LandingPage:** Wrapper com classes `dark landing-dark` e `bg-landing-bg`; overlays de glow passaram a usar `hsl(var(--wine-glow))`, `hsl(var(--primary))` em vez de roxo/azul/ciano.

### 3.2 Cores
- Substituição em todos os componentes:
  - Gradientes e glows: `primary`, `wine-glow`, `primary/20`, `primary/15`, `wine-glow/15`.
  - Bordas: `border-border`.
  - Fundos de cards/superfícies: `bg-card/80`, `bg-card/50`, `bg-card/40`, `bg-muted/30`.
  - Texto: `text-foreground`, `text-muted-foreground`, `text-primary`, `text-primary-foreground`.
  - CTAs e destaques: `bg-primary`, `hover:bg-wine-hover`, `shadow-primary/25`, `border-primary/20`.
- Remoção de hex e rgba de violeta/azul/ciano; pills “Ao vivo” e “Ranking” usam `success` e `primary`.

### 3.3 Tipografia
- Eyebrow/kicker: `text-overline` + `tracking-[0.12em]` + `text-muted-foreground`.
- Títulos de seção: `text-heading-1`, `md:text-[2.5rem]`, `lg:text-[3rem]` conforme hierarquia.
- Hero headline: `text-display` + `text-gradient-wine` para o trecho “Agora é performance.” (classe existente no projeto).
- Corpos e legendas: `text-body-lg`, `text-body`, `text-body-sm`, `text-caption`.
- Consistência de `font-sans` (Plus Jakarta Sans já é o sans do projeto).

### 3.4 Reuso de componentes
- **Button:** Uso de `Button` com `asChild` em todos os CTAs principais (Hero, Navbar, Premium, CTA final) com variantes `default` (primary) e `outline`; classes extras para tamanho (min-h, rounded-full) e sombra/hover (`hover:bg-wine-hover`, `shadow-primary/25`).
- **Padrão de seção:** Cada bloco usa `<header>` ou `<motion.header>` com eyebrow (overline + linha em gradiente primary/wine-glow), título (heading-1) e descrição (body-lg); mantida a estrutura sem criar um componente novo de seção para não alterar demais a página.

### 3.5 Motion
- Constante `MOTION_EASE = [0.25, 0.46, 0.45, 0.94]` em todos os arquivos que usam motion.
- Durações entre 0.35 e 0.45s; delays de stagger 0.04–0.06s.
- `whileInView` com `viewport={{ once: true, margin: "-60px" ou "-80px" }}` mantido; sem novos efeitos pesados.

### 3.6 Navbar e ProgressBar
- Navbar: fundo `bg-card/80`, borda `border-border`, logo com `bg-primary` e `text-primary-foreground`; links e estado ativo com `text-primary` e `bg-primary/15`; CTAs com `Button` + `asChild`.
- ProgressBar: barra de progresso com `bg-primary` e `shadow-[0_0_20px_hsl(var(--wine-glow)_/_0.5)]`; trilha `bg-foreground/5`.

### 3.7 Hero
- Glows: `bg-primary/20`, `bg-wine-glow/15`, `bg-primary/10` (sem roxo/azul).
- Orb central: gradientes com `hsl(var(--primary))`, `hsl(var(--wine))` e borda `border-border`.
- Stat chips e HUD: `bg-card/40`, `border-border`, `text-foreground`, `text-muted-foreground`; pills com `success` e `primary`.

### 3.8 Cards e superfícies
- ValueProps, HowItWorks, Experience, Comparison, Premium, SocialProof, CTA: `border-border`, `bg-card/50` a `bg-card/80`, `hover:border-primary/15` ou `hover:border-primary/20`; ícones em containers `bg-primary/15` com `text-primary`; sombras com `shadow-lg` / `shadow-xl` (tokens do sistema).

### 3.9 Footer
- Links e texto com `text-muted-foreground` e `hover:text-foreground`; logo com `bg-primary` e `text-primary-foreground`; `border-t border-border`.

---

## 4. Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/index.css` | Novas variáveis CSS `--landing-*` (fundo e glow em linha com wine/primary). |
| `tailwind.config.ts` | Cores `landing.bg`, `landing.bg-soft`, `landing.surface`. |
| `src/pages/LandingPage.tsx` | Wrapper `dark landing-dark`, `bg-landing-bg`, glows com primary/wine-glow, grid sutil. |
| `src/components/landing/LandingProgressBar.tsx` | Barra com `bg-primary`, sombra wine-glow, trilha `bg-foreground/5`. |
| `src/components/landing/LandingNavbar.tsx` | Tokens (border, card, foreground, primary); `Button` com `asChild`; logo primary; motion com MOTION_EASE. |
| `src/components/landing/LandingHero.tsx` | Glows primary/wine; tipografia (text-display, text-gradient-wine, text-body-lg, text-heading-3); `Button` CTAs; orb e cards com tokens. |
| `src/components/landing/LandingValueProps.tsx` | Kicker e linha em primary/wine-glow; cards com border-border, bg-card/70, primary para ícones; motion com stagger reduzido. |
| `src/components/landing/LandingHowItWorks.tsx` | Steps com bg-primary no número; ícones text-primary; painel com bg-primary/10; motion unificado. |
| `src/components/landing/LandingExperience.tsx` | Mockup e cards com primary/card/border; ícones text-primary; cores semânticas (destructive, warning, success). |
| `src/components/landing/LandingComparison.tsx` | Headers e cards com tokens; ícones em bg-primary/15, text-primary. |
| `src/components/landing/LandingPremium.tsx` | Header centralizado com tokens; cards e `Button` CTA com primary/wine-hover. |
| `src/components/landing/LandingSocialProof.tsx` | Blockquote e stats com border-border, bg-card/50; tipografia heading-2/display. |
| `src/components/landing/LandingCta.tsx` | Card com gradiente primary/wine-glow e hsl(var(--card)); `Button` com asChild; tipografia da escala. |
| `src/components/landing/LandingFooter.tsx` | border-border, text-foreground, text-muted-foreground; logo bg-primary. |

---

## 5. Como a landing foi alinhada ao sistema

- **Cores:** Toda a linguagem visual da landing usa `primary`, `wine-hover`, `wine-glow`, `card`, `border`, `foreground`, `muted-foreground`, `success`, `destructive`, `warning` do tema (dark). Nada de paleta roxa/azul genérica.
- **Tipografia:** Plus Jakarta Sans (font-sans) e escala do tailwind (display, heading-1/2/3, body-lg, body, body-sm, caption, overline) em todos os blocos.
- **Motion:** Um único ease e durações padronizadas; stagger leve; reveals mantidos sem exagero.
- **Componentes:** Uso explícito de `Button` (e variantes) nos CTAs; padrão de seção (eyebrow + título + descrição) mantido e estilizado com os mesmos tokens.
- **Identidade:** Fundo escuro (landing-bg + tema dark), glows em wine/primary, gradiente de headline com `text-gradient-wine`, e CTAs em primary/wine-hover deixam a página claramente no universo SanarFlix Pro, mantendo sensação premium e cinematográfica.

---

## 6. Decisões para adaptar o premium à identidade SanarFlix Pro

- **Prioridade “aderência com alto nível visual”:** Optou-se por manter o nível premium (hero full viewport, orb, glassmorphism, motion suave, seções bem espaçadas) e trocar apenas a paleta e os tokens para primary/wine, em vez de introduzir novos efeitos.
- **Glows e profundidade:** Os glows passaram a usar apenas `primary` e `wine-glow` com opacidade; o grid sutil de fundo foi mantido para profundidade, sem cor própria.
- **Orb do hero:** O elemento central do hero continua como “orb”, mas com gradientes baseados em `--primary` e `--wine` em vez de violeta/azul, preservando sensação de produto premium sem sair da marca.
- **Botões:** Todos os CTAs principais usam o mesmo `Button` do projeto, com extensões de classe (rounded-full, sombra, hover -translate-y) para manter o estilo da landing sem criar variantes novas no design system.
- **Cards:** Transparências (bg-card/50, bg-card/70) e bordas (border-border, hover:border-primary/15) seguem o padrão de superfícies do app (incluindo sidebar escura), garantindo consistência entre landing e área logada.
