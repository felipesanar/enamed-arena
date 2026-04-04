# Pre-Exam "Dark Arena" Redesign — Spec

**Date:** 2026-04-04  
**Status:** Approved  
**File affected:** `src/pages/SimuladoDetailPage.tsx`

---

## Overview

Redesign the "Pronto para começar?" section in `SimuladoDetailPage` — the card shown when a simulado is accessible and the user hasn't started it yet. The goal is a premium, immersive first impression that conveys the weight of the moment before a high-stakes exam.

The design is called **Dark Arena**: a full-width dark card with a wine-tinted gradient, radial glow orbs, SVG icon checklist in a grid, a progress bar that tracks confirmations, and a CTA button that "lights up" only when all items are checked.

---

## Visual Design

### Card Background

```
background:
  radial-gradient(ellipse 400px 320px at 96% 12%, rgba(140,32,64,0.22) 0%, transparent 68%),
  radial-gradient(ellipse 300px 300px at 4%  88%, rgba(100,18,44,0.14)  0%, transparent 65%),
  linear-gradient(155deg, #0e0810 0%, #1c0a14 50%, #2e1222 100%);
border: 1px solid rgba(255,255,255,0.06);
box-shadow:
  0 0 100px -24px rgba(140,32,64,0.4),
  0 32px 80px -16px rgba(0,0,0,0.55),
  inset 0 1px 0 rgba(255,255,255,0.07);
border-radius: 22px;
padding: 56px 64px 48px;
```

A subtle SVG noise grain layer (opacity 0.35) sits over the background to add texture.

### Typography & Colors (all on dark background)

| Element | Style |
|---|---|
| Eyebrow | 10px, tracking 0.24em, uppercase, `rgba(255,255,255,0.28)` + pulsing wine dot |
| Headline | 52px, weight 800, tracking -0.045em, white — `<em>` in `hsl(345, 62%, 65%)` |
| Description | 15px, `rgba(255,255,255,0.38)`, max-width 480px centered |
| Chips | 12px weight 600, `rgba(255,255,255,0.62)`, semi-transparent border |
| Progress label | 10px uppercase tracking 0.16em, `rgba(255,255,255,0.3)` |
| Check title | 13.5px weight 700, `rgba(255,255,255,0.72)` → `#fff` when checked |
| Check desc | 12px, `rgba(255,255,255,0.3)` → `rgba(255,255,255,0.48)` when checked |

---

## Structure

```
ArenaCard
├── [grain texture overlay]
├── Top section (centered)
│   ├── Eyebrow: "Simulado #8 · ENAMED 2026" + pulsing dot
│   ├── Headline: "Pronto para <em>começar?</em>"
│   ├── Description: "Confirme os itens abaixo…"
│   └── Chips: duration · questions · ranking status
├── Divider (horizontal gradient line)
├── Progress section
│   ├── Label "Checklist de confirmação" + counter "X de 5 itens confirmados"
│   └── Progress bar (wine gradient, animates on check)
├── Checklist grid (2-column, 5th item centered)
│   └── CheckItem × N  (icon + title + desc + checkbox)
└── CTA section
    ├── Button "Iniciar Simulado" (locked → glowing wine when all checked)
    └── Hint text ("Confirme todos…" → "Tudo certo — boa prova! 🎯")
    └── Footer: "Resultado liberado em {date}"
```

---

## Checklist Items

**Base items (always shown):**

| Key | Lucide icon | Title | Description |
|---|---|---|---|
| `duration` | `Clock` | Duração da prova | `{estimatedDuration} · {questionsCount} questões` |
| `noPause` | `Zap` | Sem pausa | O cronômetro não pode ser pausado após iniciar |
| `connection` | `Wifi` | Conexão estável | Respostas salvas automaticamente. Mantenha conexão ativa. |
| `environment` | `Monitor` | Ambiente adequado | Local tranquilo, sem interrupções |
| `fullscreen` | `Maximize2` | Prova em tela cheia | A prova abre em fullscreen. Sair do fullscreen é registrado. |

**Conditional item (appended for `available_late`):**

| Key | Lucide icon | Title | Description |
|---|---|---|---|
| `rankingNational` | `Trophy` | Entendi sobre o ranking | Esta realização não conta para o ranking nacional — janela oficial encerrou. |

### Grid layout

- 2-column grid, gap 12px
- When total items = 5: last item spans full width, constrained to 50% centered
- When total items = 6 (available_late): 3×2 grid (no orphan treatment needed)

---

## CheckItem Component Behavior

Each item is a `<button>` or clickable `<div>`:

- **Default state:** subtle dark background (`rgba(255,255,255,0.04)`), faint border
- **Hover:** slightly lighter background, border brightens, translateY(-1px)
- **Checked:** wine-tinted background (`rgba(196,90,114,0.09)`), wine border (`rgba(196,90,114,0.3)`), icon container gets wine tint, checkbox fills with wine + checkmark SVG animates in (scale + opacity)
- Clicking a checked item unchecks it

---

## Progress Bar

- Track: `rgba(255,255,255,0.08)`, 3px height, full width
- Fill: `linear-gradient(90deg, hsl(345,60%,38%), hsl(345,65%,58%))` with wine glow shadow
- Width transitions with `cubic-bezier(0.4, 0, 0.2, 1)` over 400ms
- Counter next to label: `"{n} de {total} itens confirmados"`, the number in `hsl(345, 65%, 65%)`

---

## CTA Button States

**Locked (not all checked):**
```
background: rgba(255,255,255,0.06)
border: 1.5px solid rgba(255,255,255,0.1)
color: rgba(255,255,255,0.25)
cursor: not-allowed
```

**Active (all checked):**
```
background: linear-gradient(135deg, hsl(345,65%,38%), hsl(345,65%,26%))
box-shadow: 0 10px 40px hsl(345,65%,32% / 0.6), 0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)
color: #fff
cursor: pointer
```

**Active + hover:** translateY(-2px), shadow intensifies, play icon nudges right 2px.

---

## Veteran Mode (isVeteran = true)

Users who have already completed at least one exam see a streamlined view:

- **No checklist** rendered by default
- Compact info row replaces it: duration · no-pause · fullscreen (small chips, same dark style)
- CTA is immediately enabled (not locked)
- "ver detalhes ↓" toggle below the CTA to expand the full checklist if desired
- When expanded, checklist renders identically but CTA remains enabled regardless of check state

---

## Onboarding Incomplete State

When `!isOnboardingComplete`: unchanged from current implementation — show the "Complete seu perfil primeiro" card. This section is outside the scope of this redesign.

---

## `available_late` Banner

When `status === "available_late"`, show an inline info banner between the description and the chips:

```
background: rgba(255,255,255,0.06)
border: 1px solid rgba(255,255,255,0.1)
border-radius: 12px
padding: 12px 16px
```

Text: "Você faz agora o mesmo simulado completo da preparação nacional. **Sua nota não entra no ranking nacional** porque a janela oficial encerrou — resultado e gabarito seguem valendo para o seu estudo."

Icon: `Sparkles` (wine-tinted, 16px).

---

## Animation

All existing Framer Motion wrapping (`motion.div` with `opacity 0 → 1, y: 12 → 0`) is preserved on the outer container. No new animations added beyond the transitions defined above.

The eyebrow dot and status badge dot pulse via a CSS keyframe (`blink`):
```css
@keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
```

---

## Implementation Scope

- **Modify:** `src/pages/SimuladoDetailPage.tsx` — only the `isAccessible && !simulado.userState?.started && isOnboardingComplete` branch
- **No new files** required — all styling via Tailwind + occasional `style` props for the gradient/shadow values not expressible in config
- **Icons:** use existing `lucide-react` imports already in the file (`Clock`, `Wifi`, `Monitor`, `Maximize2`) + add `Zap`, `Trophy`
- The `PremiumCard` wrapper is **replaced** in this section by a plain `motion.div` with inline dark styles (PremiumCard's light background would fight the dark design)
- All logic (`checklistItems`, `checkedItems`, `toggleCheck`, `allChecked`, `isVeteran`) remains in the same component — no extraction needed

---

## Out of Scope

- Other states on the page (upcoming, in_progress, closed_waiting, completed, fallback)
- The "Janela de Execução" info card below
- Any changes to `PremiumCard` component itself
