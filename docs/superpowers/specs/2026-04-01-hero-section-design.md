# Hero Section — Design Spec
**Data:** 2026-04-01
**Status:** Aprovado
**Arquivo alvo:** `src/components/landing/LandingHero.tsx`

---

## Resumo

Reconstrução completa da hero section. Direção: **Precision & Premium** — produto como herói, sofisticado, data-forward. Layout split dois colunas (copy esquerda / produto direita). Atmosfera cinematográfica com grid texture, glow layers e card 3D.

---

## 1. Estrutura Geral

Layout: `grid-template-columns: 1.1fr 0.9fr`, `align-items: center`, full-viewport-height (`min-h-[100svh]`).

Coluna esquerda: stack vertical de copy.
Coluna direita: card principal com chips flutuantes + stats bar abaixo.

Mobile (< lg): colapsa para coluna única. Coluna direita some — só o copy e CTA aparecem.

---

## 2. Background & Atmosfera

**Camadas (ordem z-index crescente):**

1. **Base:** `linear-gradient(145deg, #07060d 0%, #0e0b1a 50%, #080511 100%)`
2. **Grid texture:** `background-image` com linhas horizontais e verticais a 36px, `rgba(255,255,255,0.03)`. Mascarado com `radial-gradient` ellipse (85% × 85% at center) para sumir nas bordas. Opacity total no centro, invisível nas extremidades.
3. **Glow 1 — wine top-left:** `radial-gradient(circle, rgba(176,48,80,0.22) 0%, transparent 60%)`, 420×420px, `top: -80px; left: -60px`.
4. **Glow 2 — roxo bottom-right:** `radial-gradient(circle, rgba(90,60,180,0.14) 0%, transparent 62%)`, 320×320px, `bottom: -120px; right: 15%`.
5. **Glow 3 — wine sutil top-right:** `radial-gradient(circle, rgba(176,48,80,0.11) 0%, transparent 65%)`, 200×200px, `top: 35%; right: 8%`.

Todos os orbs ficam em `pointer-events: none` e `aria-hidden`.

---

## 3. Coluna Esquerda — Copy

**Ordem de entrada (Framer Motion stagger):**

| Elemento | delay |
|---|---|
| Eyebrow badge | 0.05s |
| Headline h1 | 0.15s |
| Subhead | 0.26s |
| CTA row | 0.36s |
| Social proof | 0.44s |

Todos: `initial={{ opacity: 0, y: 20 }}`, `animate={{ opacity: 1, y: 0 }}`, `duration: 0.55`, `ease: [0.32, 0.72, 0.2, 1]`.

### 3.1 Eyebrow Badge

```tsx
<div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full
  border border-primary/28 bg-primary/10 backdrop-blur-sm">
  <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
  <span className="text-overline uppercase tracking-[0.13em] text-primary/95">
    SanarFlix Simulados
  </span>
</div>
```

### 3.2 Headline

```tsx
<h1 className="text-[3.2rem] sm:text-[3.6rem] lg:text-[3.2rem] xl:text-[3.6rem]
  font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground">
  Performance com{" "}
  <em className="not-italic bg-gradient-to-r from-[#d8405e] to-primary
    bg-clip-text text-transparent">
    precisão cirúrgica.
  </em>
</h1>
```

> **Copy placeholder.** O usuário vai refinar o texto. A estrutura (2 linhas, quebra depois de "com", gradiente na segunda) é parte do design.

### 3.3 Subhead

```tsx
<p className="text-body-lg text-muted-foreground max-w-[34ch] leading-relaxed">
  Análise por área, ranking em tempo real e IA que define exatamente
  o que revisar antes da próxima prova.
</p>
```

### 3.4 CTA Row

**Botão primário:**
```tsx
<Button size="lg" className="min-h-[52px] px-7 rounded-xl font-bold text-base
  bg-primary text-primary-foreground
  shadow-[0_6px_28px_hsl(var(--primary)/0.45),0_2px_8px_hsl(var(--primary)/0.25)]
  hover:bg-wine-hover hover:shadow-[0_10px_40px_hsl(var(--primary)/0.55)]
  hover:-translate-y-0.5 transition-all duration-300" asChild>
  <Link to="/login">Entrar no próximo simulado →</Link>
</Button>
```

**Link secundário:**
```tsx
<a href="#como-funciona"
  className="text-body text-muted-foreground/60 font-medium
  border-b border-muted-foreground/20 hover:text-muted-foreground
  transition-colors duration-200 pb-px">
  Ver como funciona
</a>
```

### 3.5 Social Proof

5 avatars sobrepostos (`-ml-1.5` a partir do 2°) + texto "**18.400 alunos** em preparação agora".
Avatars: círculos 24px com initials, cores distintas (`bg-purple-700`, `bg-blue-700`, `bg-primary`, `bg-cyan-800`, `bg-green-700`), `border-2 border-background`.

---

## 4. Coluna Direita — Visual

### 4.1 Scene wrapper

`position: relative`, `padding: 0 2.5rem` (espaço para chips flutuantes nas laterais).
Parallax scroll: `useTransform(scrollY, [0, 400], [0, 60])` no y, `useTransform(scrollY, [0, 200], [1, 0.7])` no opacity. Igual ao comportamento atual.

### 4.2 Chips Flutuantes

Dois chips posicionados absolutamente, centralizados verticalmente no card:

- **Esquerda (`chip-left`):** `left: 0; top: 50%; transform: translateY(-50%)`
  Conteúdo: valor `▲ +12%` + label `Evolução` — **estático/demo**
- **Direita (`chip-right`):** `right: 0; top: 50%; transform: translateY(-50%)`
  Conteúdo: valor `#42` + label `Ranking` — **estático/demo**

Estilo: `bg-card/92 backdrop-blur-xl border border-white/10 rounded-[11px] p-2.5 shadow-[0_10px_32px_-4px_rgba(0,0,0,0.6)]`

Animação de entrada: chips entram com `initial={{ opacity:0, x: ±16 }}`, stagger 0.5s e 0.6s após mount.

### 4.3 Card Principal (AI Insight)

**Container:** `perspective: 900px`

**Card:** `transform: rotateX(2.5deg) rotateY(-2deg)` estático. Hover: `rotateX: -1deg, rotateY: 1.5deg` via `whileHover` com spring `{ stiffness: 300, damping: 35 }`. Só ativa em `(min-width: 1024px) and (hover: hover)`.

```
background: linear-gradient(165deg, rgba(18,14,30,0.97), rgba(11,8,20,0.99))
border: 1px solid hsl(var(--primary)/0.32)
border-radius: 20px
padding: 1.25rem 1.4rem
box-shadow:
  0 32px 80px -16px rgba(0,0,0,0.7),
  inset 0 1px 0 rgba(255,255,255,0.08),
  0 0 0 1px hsl(var(--primary)/0.08)
```

Pseudo `::before`: `radial-gradient(ellipse 80% 55% at 50% -5%, hsl(var(--primary)/0.14) 0%, transparent 60%)` — glow interno no topo do card.

**Conteúdo do card:**

1. Eyebrow: `✦ Análise SanarFlix` (text-overline, cor primary)
2. Headline: `Unifesp + 3 instituições` (1.2rem, font-extrabold)
3. Desc: `você seria aprovado nestas instituições com o desempenho atual` (text-body-sm, muted)
4. Divisor: `h-px bg-white/7`
5. **Area grid:** `grid-cols-3 gap-1.5`
   - Clínica Méd. → `82%` (text-success)
   - Cirurgia → `68%` (text-warning)
   - Pediatria → `54%` (text-primary/destructive)
6. **Progress bar:** label "Progresso geral" + track + fill 74% + valor "74%"

> **Dados:** todos os valores (Unifesp, scores, porcentagens) são **estáticos/demo** — hardcodados no componente. O componente `HeroAiInsight` existente é **removido** e substituído por este card. Não há integração com dados reais neste escopo.

### 4.4 Stats Bar

Abaixo do scene wrapper, `margin-top: 1.1rem`:

```
bg-white/[0.025] border border-white/[0.06] rounded-xl p-3
display: flex, 3 stats separados por divisores verticais
```

| Stat | Valor |
|---|---|
| aprovados | 4.200+ |
| provas no banco | 18 |
| satisfação | 97% |

---

## 5. Animações

| Elemento | Entrada | Timing |
|---|---|---|
| Background orbs | `opacity: 0 → 1`, duration 1.2s | imediato |
| Eyebrow | `opacity:0, y:20 → opacity:1, y:0` | delay 0.05s |
| H1 | `opacity:0, y:32 → opacity:1, y:0` | delay 0.15s |
| Subhead | `opacity:0, y:24 → opacity:1, y:0` | delay 0.26s |
| CTA row | `opacity:0, y:24 → opacity:1, y:0` | delay 0.36s |
| Social proof | `opacity:0, y:20 → opacity:1, y:0` | delay 0.44s |
| Card (coluna direita) | `opacity:0, scale:0.97, y:30 → 1, 1, 0` | delay 0.18s, duration 0.8s |
| Chip esquerda | `opacity:0, x:-16 → opacity:1, x:0` | delay 0.5s |
| Chip direita | `opacity:0, x:16 → opacity:1, x:0` | delay 0.6s |
| Stats bar | `opacity:0, y:16 → opacity:1, y:0` | delay 0.65s |

Easing padrão: `[0.32, 0.72, 0.2, 1]`
`useReducedMotion()`: desativa todas as animações de entrada e hover se preferência ativa.

---

## 6. Responsividade

| Breakpoint | Comportamento |
|---|---|
| `< lg (1024px)` | Grid colapsa para 1 coluna. Coluna direita oculta (`hidden lg:block`). Social proof simplificado. |
| `lg` | Grid `1.1fr 0.9fr`. Tilt 3D ativo. Chips flutuantes visíveis. |
| `xl` | Headline aumenta para 3.6rem. Padding aumenta. |
| `2xl` | Padding lateral aumenta, headline até 3.8rem opcional. |

Mobile: hero mantém `min-h-[100svh]`, copy centraliza, CTA full-width, sem visual direita.

---

## 7. Tokens & Classes Existentes

Reutilizar sem modificar:
- `text-primary` / `bg-primary` / `hsl(var(--primary))`
- `text-muted-foreground`
- `bg-card`, `border-border`
- `text-overline`, `text-body`, `text-body-sm`
- `shadow-glow-wine`, `shadow-glow-wine-lg`
- `wine-hover` para hover do botão
- `SPRING_GENTLE` de `@/lib/landingMotion`
- `trackEvent` de `@/lib/analytics`

---

## 8. O que NÃO muda

- `LandingNavbar.tsx` — não tocar
- Rota `/login` no CTA primário
- `trackEvent("lead_captured", { source: "landing_hero_primary" })`
- `useReducedMotion()` obrigatório
- `id="hero"` no `<section>` (âncora da navbar)
- `HeroAiInsight` é **removido** — substituído pelo novo card descrito em 4.3

---

## 9. Fora de Escopo

- Outras seções da landing (Navbar, Footer, etc.)
- Copy final da headline e subhead (o usuário vai refinar)
- Dados reais de "aprovados", "provas", "satisfação" (usar valores reais da API ou hardcode temporário)
