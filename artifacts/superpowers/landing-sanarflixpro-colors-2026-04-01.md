# Landing — remapeamento Theme SanarFlix PRO (2026-04-01)

## Mapeamento pré-correção (elementos)

| Categoria | Antes | Problema / nota |
|-----------|--------|-----------------|
| Textos brancos / off-white | `text-foreground`, `text-muted-foreground`, títulos | Mantidos — legíveis no escuro |
| Textos vinho sobre fundo escuro | `text-primary` (HSL ~20% L) | Contraste baixo; confundia com “cor de botão” |
| Botões primários | `bg-primary` + `text-primary-foreground` | Mantidos; `main` (#64031E) via tokens |
| Badges / pills com borda primary | `border-primary/*`, `bg-primary/10` | Estrutura preservada |
| Ícones em cards | `text-primary` ou `text-landing-accent` (classe sem token) | Unificado em `text-landing-accent` |
| Gradientes hero / “wine” | Dois tons próximos, pouca profundidade | dark → main → light / mid |
| Halos página | `wine-glow` genérico | `wine-glow` alinhado à família sanar-light |
| Cards (borda, fundo) | `border-border`, `bg-card/*` | Sem redesign — só ícones/acentos internos onde necessário |

## Tokens `.landing-dark` (`src/index.css`)

- `--brand-sanar-main` → #64031E (CTA, barras, primary)
- `--brand-sanar-dark` → #3D0011 (profundidade em gradientes / radiais)
- `--brand-sanar-light` → #A3455D (família de halos e gradiente hero)
- `--brand-sanar-lighter` / `--brand-sanar-surface` → reserva para uso em superfícies claras da marca
- `--landing-accent-text` → texto/ícone de destaque no escuro (mais luminoso que `main`, aquecido vs. light)
- `--landing-accent-mid` → ponte em gradientes (main ↔ accent)
- `--wine-hover` → hover CTA (vinho mais claro, sem rosa UI)
- `--wine-glow` → halos coerentes com identidade

## Utilitários CSS (`.landing-dark`)

- `.text-gradient-wine` — dark → main → accent-mid
- `.text-gradient-hero-em` — dark → main → sanar-light → accent-mid
- `.bg-gradient-brand-progress` — barra de progresso do card hero

## Tailwind (`tailwind.config.ts`)

- `landing.accent` / `landing.accent-mid`
- `glow-wine` / `glow-wine-lg` → `hsl(var(--primary) / …)` (coerente com o tema ativo)

## Arquivos TSX alterados

- `LandingHero.tsx`, `LandingNavbar.tsx`, `LandingExperience.tsx`, `LandingHowItWorks.tsx`, `LandingComparison.tsx`, `LandingValueProps.tsx`, `LandingSocialProof.tsx`, `LandingCta.tsx`, `LandingPremium.tsx`, `LandingPage.tsx`
- **Mantido com `text-primary`**: `LandingExamDemo.tsx` (UI do “produto” demo sobre superfícies claras)

## Validação (checklist)

- **Branco mantido**: títulos, corpo, muted, links neutros — sem mudança de intenção
- **Vinho/vermelho corrigido**: labels, ícones, nav ativa, estrelas, chips hero, métricas do card — `text-landing-accent`
- **main**: botões, número dos passos, progress bar track fill base, bordas primary existentes
- **dark**: radiais CTA + gradiente `text-gradient-wine` / hero-em
- **light / mid**: stops intermediários nos gradientes e orb 2 da página
- **Contraste**: acento em ~62% L no escuro vs. primary ~20% L
- **Identidade**: paleta explícita SanarFlix PRO; sem “pintar tudo de vermelho”

## Verificação

- `npm run test -- --run` → 45 passed

## Revisão (severidade)

- **Blocker**: nenhum
- **Major**: nenhum
- **Minor**: `glow-wine` global agora segue `--primary` de cada tema (dashboard claro/escuro pode ter halo levemente diferente)
- **Nit**: tons `lighter`/`surface` reservados para evolução (ex. seções claras futuras)
