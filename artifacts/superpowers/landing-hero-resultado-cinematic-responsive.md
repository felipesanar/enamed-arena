# Hero — card Resultado: refinamento 3D cinematográfico responsivo

**Data:** 2025-03-18  
**Arquivo principal:** `src/components/landing/LandingHero.tsx`

## 1) Diagnóstico do efeito (antes / linha base)

### O que funcionava bem
- **Camadas** (base escura, halos radiais, highlight de borda, inset/vinheta) criavam volume e clima premium.
- **Hierarquia** do conteúdo (título, métricas, análise, blocos inferiores) estava estruturada.
- Uso de **tokens** (primary, wine) alinhado à marca.

### Riscos / excessos
- **Mesma intensidade** de luz/sombra em todos os breakpoints podia parecer “pesada” em laptop 13" ou confundir leitura.
- **Perspectiva + tilt** sem gate adequado: em touch, hover “falso” ou tilt residual prejudica sensação de produto sólido.
- **Reflexo lateral** e múltiplas sombras: em telas pequenas ou GPUs modestas, risco de ruído visual e custo de pintura.

### Mobile
- Card 3D completo em coluna estreita: risco de **overflow**, **microtipo ilegível** e **efeito gimmick** sem ganho de conversão.

## 2) O que foi refinado visualmente

- **Sombras externas** em três níveis (`base` → `xl` → `2xl`) para profundidade sem “lama” em `lg` estreito.
- **Halos** com opacidade progressiva; **reflexo lateral** apenas `xl+` para reduzir artefato em telas médias.
- **Inset + vinheta** mais leves em `lg`, mais profundos em `xl+`.
- **Métricas e subcards**: sombras mais contidas em `lg`, mais contraste de plano em `xl+`.
- **`HeroAiInsight` (modo cinematic)**: overlays um pouco mais contidos em compacto; radial/gradiente reforçados em `xl`.

## 3) Adaptação por contexto

### Desktop grande (xl / 2xl)
- Mais **perspectiva** (`xl:[perspective:1520px]`).
- **Sombras** mais longas e presença; **reflexo** lateral ativo.
- **Hover tilt** muito sutil (spring), só com ponteiro fino + hover real.

### Desktop intermediário (lg — laptop)
- Perspectiva `lg:[1280px]`, sombras intermediárias.
- Sem reflexo lateral até `xl`; menos ruído em 13–14".

### Tablet / mobile (`< lg`)
- **Perspectiva desligada** (`max-lg:[perspective:none]`).
- Coluna dedicada **`lg:hidden`**: mesma linguagem (gradiente, halo, inset leve), **poucas camadas**, foco em **números e texto**.
- **Sem dependência de hover**; animação de entrada leve no painel, não no “tilt”.

## 4) Interações por dispositivo

- **Desktop:** `matchMedia('(min-width: 1024px) and (hover: hover)')` + `useReducedMotion` → tilt só quando faz sentido.
- **Touch / tablet:** painel estático premium; sem inclinação que pareça bug.

## 5) Performance e robustez

- Evitar **blur** pesado no card mobile (prioridade: sombra + gradiente).
- `will-change-transform` **apenas** quando tilt pode ativar.
- **Overflow:** `overflow-hidden` nos blocos que precisam; painel mobile com `isolate` para empilhamento limpo.

## 6) Legibilidade

- Métricas com **tabular-nums** e tamanhos escalonados `sm`+.
- Análise: modo compact cinematic mantém contraste sem competir com os números.

## 7) Arquivos alterados

- `src/components/landing/LandingHero.tsx` — card 3D desktop, `HeroAiInsight`, painel `lg:hidden`, media query tilt.

## 8) Verificação

```bash
npm run build
```

Inspeção visual recomendada: Chrome DevTools — larguras 360, 768, 1024, 1280, 1536+; preferências “reduzir movimento”.

## 9) Revisão (severidade)

- **Major:** nenhum bloqueador conhecido.
- **Minor:** avisos do Tailwind sobre classes `duration-[…]` / `ease-[…]` ambíguas no build (cosmético; pode silenciar com escape se incomodar).
- **Nit:** QA em dispositivos reais (iOS Safari) para sombras e subpixel.
