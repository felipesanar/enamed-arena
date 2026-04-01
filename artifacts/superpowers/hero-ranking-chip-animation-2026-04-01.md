# Hero ranking chip — animação 42 → 1

## O que foi feito

- Novo componente `HeroRankingChip` em `src/components/landing/LandingHero.tsx`.
- Contagem animada com `framer-motion` `animate(42, 1, …)` (~3,6s, ease-out), início após ~900ms (após entrada do chip).
- Cada troca de inteiro usa `AnimatePresence` + slide vertical leve (subida visual do dígito).
- Refino progressivo: cor `muted` → `foreground` → `landing-accent` + `text-shadow`/glow; borda e `box-shadow` do card reforçam perto do 1º lugar; escala do bloco numérico aumenta suavemente (`emphasis = progress²`).
- `prefersReducedMotion === true`: mostra direto `#1`, sem tween longo.
- `aria-label` no chip descreve a demonstração para leitores de tela.

## Verificação

- `npm run test -- --run src/components/landing/LandingHero.test.tsx` — passou.
- Mock de `framer-motion` atualizado: `animate` + `motion.span`.

## Revisão (severidade)

- **Nit:** Nos testes, o mock de `animate` não dispara `onUpdate`; o número exibido pode permanecer 42 (não há asserção sobre o ranking).
