# Auditoria e melhoria de motion — Landing Plataforma de Simulados

## Escopo auditado

- **Navbar:** entrada, estado sticky, transições, highlight de seção.
- **Hero:** entrada (eyebrow, headline, subhead, CTAs, quick cards, painel direito, cards orbitais), parallax, fundo, análise SanarFlix.
- **ValueProps (Diferenciais):** header, grid de cards, viewport, hover.
- **HowItWorks (Jornada):** header, steps, painel direito, viewport, hover.
- **Experience:** header, mockup, cards, viewport, hover.
- **Comparison (Performance):** header, 3 cards, bloco final, viewport, hover.
- **Premium (PRO):** header, 4 cards, CTA, viewport, hover.
- **SocialProof:** header, quote, stats, tags do rodapé, viewport, hover.
- **Cta final:** card, viewport, botões.
- **Footer:** entrada.
- **ProgressBar:** transição do scroll.

---

## Problemas encontrados

### 1. Sistema de motion inconsistente
- **Easing:** Hero/Navbar usavam `[0.32, 0.72, 0.2, 1]`; outras seções usavam `[0.25, 0.46, 0.45, 0.94]`. Sem token único.
- **Viewport:** Uso misto de `margin: "-60px"`, `"-80px"`, `"-40px"` ou sem margin; `amount` não usado. Elementos disparando tarde ou cedo demais.
- **Durações:** 0.35 e 0.4 usados de forma solta; sem escala (fast/normal/slow).
- **Variantes:** ValueProps tinha container/item; outros seções não reutilizavam padrão.

### 2. Headers de seção sem animação
- **ValueProps:** Header (eyebrow, título, descrição) estático; só o grid animava.
- **Demais seções:** Headers com `whileInView` genérico (opacity + y) sem stagger entre eyebrow → título → descrição.

### 3. Scroll reveal mal calibrado
- **Margin negativa assimétrica:** Só `margin: "-80px"` (top) em alguns; ideal é margin no bottom para trigger quando o bloco está prestes a entrar.
- **Sem `amount`:** Não havia critério “X% visível” para disparar.
- **Premium:** Os 4 cards PRO não tinham motion individual; apenas o container (opacity/y), sem stagger por card.

### 4. Hover fraco ou ausente
- **ValueProps:** Hover com border/shadow mas sem elevação (y).
- **HowItWorks:** Steps sem hover.
- **Experience:** Cards com hover de border/bg, sem movimento.
- **Comparison:** Cards sem hover de elevação.
- **Premium:** Cards estáticos (div), sem motion nem hover.
- **SocialProof:** Stats sem hover.
- **CTA:** Botões com hover bom; card sem necessidade de hover.

### 5. Elementos “mortos”
- **Footer:** Sem entrada; aparecia de forma brusca.
- **ProgressBar:** Transição 150ms sem `will-change`; possível melhora de fluidez no scroll.

### 6. Repetição genérica
- Mesma animação “opacity + y” em vários headers sem hierarquia (stagger).
- Delays de stagger inconsistentes (0.04, 0.05, 0.06, 0.08) entre seções.

### 7. CTA final
- Uma única entrada do card; sem stagger interno (opção deixada de fora para evitar dupla animação e manter foco no card).

---

## Melhorias implementadas

### 1. `src/lib/landingMotion.ts`
- **EASE** único: `[0.32, 0.72, 0.2, 1]`.
- **VIEWPORT_REVEAL:** `once: true`, `margin: "0px 0px -80px 0px"`, `amount: 0.2` (trigger ~80px antes de entrar, ou 20% visível).
- **VIEWPORT_HEADER:** `margin: "0px 0px -100px 0px"`, `amount: 0.15` para headers.
- **Durações:** `DURATION_FAST` (0.28), `DURATION_NORMAL` (0.42), `DURATION_SLOW` (0.55).
- **Variantes reutilizáveis:** `containerReveal`, `itemReveal`, `itemRevealSubtle`, `headerReveal`, `headerItemReveal`.

### 2. ValueProps (Diferenciais)
- Header com **headerReveal** + **headerItemReveal** (stagger eyebrow → título → descrição).
- Grid com **containerReveal** + **itemReveal** e **VIEWPORT_REVEAL**.
- Cards com **whileHover** `y: -4`, hover de border/glow e transição do blur interno.

### 3. HowItWorks (Jornada)
- Header com **headerReveal** + **headerItemReveal**.
- Steps com entrada `x: -20` e **VIEWPORT_REVEAL**; delay `i * 0.06`; **whileHover** `x: 4` e hover de border/bg.
- Painel direito com **VIEWPORT_REVEAL** e duração normal.

### 4. Experience
- Header com **headerReveal** + **headerItemReveal**.
- Mockup com **VIEWPORT_REVEAL** e `y: 28`.
- Cards com **VIEWPORT_REVEAL**, stagger por índice e **whileHover** `y: -3` + border/bg.

### 5. Comparison (Performance)
- Header com **headerReveal** + **headerItemReveal**.
- Grid com **containerReveal** + **itemReveal** e **VIEWPORT_REVEAL**.
- Cards com **whileHover** `y: -4` e hover border/shadow.
- Bloco final com **VIEWPORT_REVEAL**.

### 6. Premium (PRO)
- Header com **headerReveal** + **headerItemReveal**.
- Cada card PRO é **motion.div** com **containerReveal** + **itemReveal** e stagger.
- Cards com **whileHover** `y: -3` e hover border/bg.
- Botão com **VIEWPORT_REVEAL** e transição de hover 300ms.

### 7. SocialProof
- Header com **headerReveal** + **headerItemReveal**.
- Quote e stats com **VIEWPORT_REVEAL**; stats com delay `i * 0.07` e **whileHover** `y: -3`.
- Tags do rodapé com entrada em stagger e separador “·”.

### 8. CTA final
- Card com **VIEWPORT_REVEAL** e entrada `opacity + y: 28`; duração e easing do sistema.
- Botões com hover já refinado (translate, shadow).

### 9. Footer
- **motion.footer** com **VIEWPORT_REVEAL** e fade-in ao entrar na viewport.

### 10. ProgressBar
- **will-change-transform** e **duration-200** para transição do scaleX no scroll.

### 11. Hero e Navbar
- Mantidos como estão; já usam EASE `[0.32, 0.72, 0.2, 1]` e comportamento de scroll/sticky coerente. Hero com parallax e stagger próprio.

---

## Timing e triggers

- **Trigger:** Elementos disparam quando estão a ~80px de entrar (margin bottom) ou quando 20% do elemento está visível (`amount: 0.2`), evitando entrada tardia e “pipocagem”.
- **Headers:** Trigger um pouco mais antecipado (margin -100px, amount 0.15) para o título entrar antes do conteúdo.
- **Stagger:** 0.06–0.07 entre itens de grid/cards; 0.07 entre itens de header (eyebrow → título → descrição).
- **Duração:** Entradas em 0.42s (normal); hovers em 0.2–0.28s.

---

## Consistência com design system

- Easing e durações centralizados em `landingMotion.ts`.
- Tokens de cor e tipografia não alterados; apenas motion e viewport.
- Componentes UI (Button, etc.) mantidos; apenas classes de transição/hover ajustadas onde necessário.
- Hero e Navbar continuam alinhados à identidade SanarFlix Pro.

---

## Arquivos alterados

| Arquivo | Alteração |
|--------|-----------|
| `src/lib/landingMotion.ts` | Novo: easing, viewport, durações, variantes. |
| `src/components/landing/LandingValueProps.tsx` | Header animado, viewport/hover, uso de landingMotion. |
| `src/components/landing/LandingHowItWorks.tsx` | Header animado, viewport, hover nos steps, landingMotion. |
| `src/components/landing/LandingExperience.tsx` | Header animado, viewport, hover nos cards, landingMotion. |
| `src/components/landing/LandingComparison.tsx` | Header animado, container/item reveal, viewport, hover, landingMotion. |
| `src/components/landing/LandingPremium.tsx` | Header animado, cards com motion + stagger, hover, landingMotion. |
| `src/components/landing/LandingSocialProof.tsx` | Header animado, viewport, hover nos stats, tags com stagger, landingMotion. |
| `src/components/landing/LandingCta.tsx` | Viewport e easing do sistema; entrada do card refinada. |
| `src/components/landing/LandingFooter.tsx` | motion.footer com fade-in ao entrar na viewport. |
| `src/components/landing/LandingProgressBar.tsx` | will-change-transform e duration-200. |

---

## Verificação

- `npm run build` — validar build.
- Testar `/landing`: scroll contínuo, entrada de seções, hover em cards e botões, footer e barra de progresso.
- Testar em viewport reduzido (mobile/tablet) para garantir que animações e viewport seguem adequados.
