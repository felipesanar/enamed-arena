# Redesign — Tela de Resultado

**Data:** 2026-04-12
**Escopo:** `src/pages/ResultadoPage.tsx`
**Status:** aprovado para implementação

---

## Contexto e Motivação

A tela de Resultado é a primeira tela pós-prova que o aluno vê quando o resultado é liberado (status `results_available` / `completed`). O acesso acontece via:
- Banner `NextSimuladoBanner` na home (cenário `after_done`) → "Ver resultado"
- Notificação de email

O objetivo é criar um momento de impacto emocional: o aluno espera dias para ver seu score. A UI precisa estar à altura dessa expectativa.

---

## O que já foi feito (commits anteriores)

- Bug corrigido: Erros e Em branco agora usam valores oficiais do servidor (`officialAnswered - officialCorrect`, `totalQuestions - officialAnswered`)
- Seção "Desempenho por Grande Área" removida
- `PageHeader`, `PageBreadcrumb`, `SectionHeader`, `StatusBadge`, `Stethoscope` removidos
- `SimuladoResultNav` removido (não fica nessa tela)

---

## Decisões de Design

### Hero card
**Fundo wine escuro** (Option A) com **ring SVG** de progresso (Option B).

Razão: impacto emocional máximo com visualização clara do percentual.

### CTA
Botão perolado "Ir para correção comentada" com efeito shimmer — único CTA de navegação na tela.

Razão: foco total na próxima ação, sem dispersão em tabs de navegação.

---

## Spec Detalhada

### 1. Hero Card

**Estrutura geral:**
```
┌─────────────────────────────────────┐  bg: gradient wine escuro
│         [ring 140px c/ 31%]         │  box-shadow dramático
│      31 de 100 questões corretas     │
│                                      │
│  [✓ 31]  [✗ 69]  [— 0]  [📋 100]   │  4 stat cards
│                                      │
│  ─────────────────────────────────  │  divider
│  [⭐ Ponto forte]  [📈 Oportunidade] │  2 highlight cards
│                                      │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │  faixa escura
│  [ ✦ Ir para correção comentada → ] │  CTA perolado
└─────────────────────────────────────┘
```

**Background do card:**
```css
background: linear-gradient(155deg, #7a1a32 0%, #5c1225 45%, #3d0b18 100%);
border-radius: 24px;
box-shadow: 0 32px 64px -20px rgba(142,31,61,0.7), 0 8px 24px -8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08);
```

Glow orb decorativo: `position: absolute; top: -60px; right: -60px; width: 260px; height: 260px; background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)`.

**Animação de entrada:** `motion.div` com `opacity: 0, scale: 0.98` → `opacity: 1, scale: 1`, `duration: 0.5` (respeitando `prefersReducedMotion`).

---

### 2. Ring de Progresso

**SVG inline**, `width: 140px, height: 140px`, `transform: rotate(-90deg)`.

- `r = 60` → circunferência = `2π × 60 ≈ 376.99`
- `stroke-dasharray: 376.99`
- `stroke-dashoffset: 376.99 × (1 - percentage/100)` — calculado dinamicamente
- Track: `stroke: rgba(255,255,255,0.08); stroke-width: 10`
- Fill: gradiente linear `#ff9ab0` → `#ffffff`, `stroke-width: 10`, `stroke-linecap: round`
- `filter: drop-shadow(0 0 8px rgba(255,180,180,0.4))`

**Gradiente SVG** via `<defs><linearGradient id="ringGrad">`:
```svg
<stop offset="0%" stop-color="#ff9ab0"/>
<stop offset="100%" stop-color="#ffffff"/>
```

**Animação do ring:** Framer Motion `animate={{ strokeDashoffset: targetOffset }}` com `duration: 1, ease: "easeOut"`, delay `0.3`. Começa em `376.99` (zero) e anima até o valor final.

**Centro do ring:**
- Ícone Trophy (Lucide) `20×20`, `color: rgba(255,255,255,0.45)`, `margin-bottom: 4px`
- Percentual: `text-display font-bold color: #fff`
- Label: `"do total"` em `text-overline uppercase color: rgba(255,255,255,0.4)`

**Abaixo do ring:**
```
{officialCorrect} de {overall.totalQuestions} questões corretas
```
`text-body color: rgba(255,255,255,0.55)` — números em `rgba(255,255,255,0.9) font-semibold`.

---

### 3. Stat Cards (4 cards em grid)

Grid `grid-cols-4 gap-2`, `margin-bottom: 16px`.

Cada card: `bg: rgba(255,255,255,0.07)`, `border: 1px solid rgba(255,255,255,0.1)`, `border-radius: 14px`, `padding: 12px 6px 10px`, `text-align: center`.

| Stat | Ícone Lucide | Cor do ícone-wrap | Valor |
|------|-------------|-------------------|-------|
| Acertos | `CheckCircle2` | `bg: rgba(34,197,94,0.15) color: #4ade80` | `officialCorrect` |
| Erros | `XCircle` | `bg: rgba(239,68,68,0.15) color: #f87171` | `officialIncorrect` |
| Em branco | `MinusCircle` | `bg: rgba(255,255,255,0.08) color: rgba(255,255,255,0.4)` | `officialUnanswered` |
| Respondidas | `ClipboardCheck` | `bg: rgba(99,179,237,0.15) color: #7dd3fc` | `officialAnswered` |

Ícone-wrap: `32×32px border-radius: 9px margin: 0 auto 8px`.
Valor: `text-heading-2 color: #fff`.
Label: `text-caption uppercase tracking-wider color: rgba(255,255,255,0.35)`.

Animação stagger: cada card `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}`.

---

### 4. Divider

`height: 1px; background: rgba(255,255,255,0.08); margin: 0 -4px 16px`.

---

### 5. Highlight Cards (Ponto Forte / Oportunidade)

Grid `grid-cols-2 gap-2.5`, `margin-bottom: 24px`.

Exibido apenas quando `byArea.length > 1` (igual ao atual).

| Card | Border/bg | Ícone | Tag color |
|------|-----------|-------|-----------|
| Ponto forte (`bestArea`) | `bg: rgba(34,197,94,0.08) border: rgba(34,197,94,0.2)` | `Star` | `#4ade80` |
| Oportunidade (`worstArea`) | `bg: rgba(251,146,60,0.08) border: rgba(251,146,60,0.2)` | `TrendingDown` | `#fb923c` |

Ícone-wrap: `36×36px border-radius: 10px`.
Tag: `text-caption uppercase tracking-wide font-bold`.
Título: `text-body font-semibold color: rgba(255,255,255,0.9)`.
Sub: `text-caption color: rgba(255,255,255,0.4)` — `{area.correct}/{area.questions} · {area.score}%`.

---

### 6. CTA Perolado

**Wrapper** (faixa escura no rodapé do card):
```
margin: 0 -28px -28px (neutraliza o padding do card)
padding: 20px 28px 28px
background: rgba(0,0,0,0.2)
border-top: 1px solid rgba(255,255,255,0.06)
border-radius: 0 0 24px 24px
```

Hint acima do botão: `"Pronto para conferir questão por questão?"` — `text-caption color: rgba(255,255,255,0.3) text-center mb-3`.

**Botão perolado:**
```css
background:
  linear-gradient(135deg,
    rgba(255,255,255,0.18) 0%,
    rgba(255,220,230,0.08) 30%,
    rgba(255,255,255,0.05) 50%,
    rgba(230,200,215,0.12) 70%,
    rgba(255,255,255,0.2) 100%
  ),
  linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, #f0e4ea 100%);

box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.6),
  inset 0 -1px 0 rgba(180,140,155,0.3),
  0 10px 32px -8px rgba(255,255,255,0.3),
  0 4px 12px -4px rgba(0,0,0,0.35);

border-radius: 16px;
padding: 17px 24px;
color: #4a0e22;
font-size: text-body;
font-weight: 700;
```

**Shimmer sweep** via pseudo-elemento `::before` (não disponível em Tailwind inline — usar `<style>` tag ou className com CSS modules não é padrão no projeto). **Implementação:** usar um `<span>` absoluto dentro do botão com `animate` do Framer Motion:
```tsx
<motion.span
  className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-15deg]"
  animate={{ x: ['-100%', '300%'] }}
  transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
/>
```

**Conteúdo do botão** (flex, items-center):
- Ícone `BookOpen` (Lucide) `20×20` à esquerda
- Texto `"Ir para correção comentada"` no centro
- Ícone `ArrowRight` `18×18` à direita, `opacity: 0.5`

**Link:** `<Link to={`/simulados/${id}/correcao`}>` — mesma rota já existente.

---

### 7. Elementos mantidos sem mudança

- `UpgradeBanner` para `!hasCadernoErros` — mantido após o CTA (fora do hero card, no fluxo normal da página)
- `hasComparativo` link — mantido após o UpgradeBanner
- Todos os estados de erro/loading — sem mudanças
- Prop `adminPreview` — sem mudanças
- Toda a lógica de dados — sem mudanças

---

### 8. Remoções finais

- `SimuladoResultNav` — já removido
- `BarChart3` import — já não usado (remover se ainda presente)
- `Trophy` import — mantido (usado no ring center)

---

## Arquivos a modificar

| Arquivo | Natureza |
|---------|----------|
| `src/pages/ResultadoPage.tsx` | Todas as mudanças visuais |

Nenhum outro arquivo precisa ser alterado.

---

## Acessibilidade

- Ring: `role="img" aria-label={`${officialPercentage}% de aproveitamento`}` no wrapper do ring
- Botão CTA: `Link` semântico com texto descritivo
- Stat cards: `aria-label` implícito via texto visível
