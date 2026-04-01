# Landing CTA final — elevação de UI (2026-04-01)

## Alterações (`src/components/landing/LandingCta.tsx`)

- Card: `rounded-[1.75rem]`, borda `primary/18`, `backdrop-blur`, sombra em camadas (drop + ring + highlight interno).
- Fundo: radiais empilhados (topo, cantos, base) + base `card/0.88`.
- Camada decorativa: highlight superior, orbs blur, grid sutil com máscara radial.
- Eyebrow: badge com `Sparkles`, borda e `text-landing-accent` (visível e sem `aria-hidden` no rótulo).
- Título: `text-balance`, destaque **próximo simulado** com `text-gradient-wine`.
- Divisor sutil entre título e corpo; parágrafo com `id="cta-final-desc"` e `aria-describedby` nos links.
- CTAs: coluna no mobile, linha no `sm+`; primário com glow e seta com hover; secundário com vidro leve e hover em primary.

## Verificação

- `read_lints` em `LandingCta.tsx`: sem issues.
- `npm run lint` / `npm run test`: projeto tem avisos/erros e 1 teste falhando em `DesempenhoPage.test.tsx` (pré-existente, não ligado ao CTA).

## Review (severidade)

- **Blocker:** nenhum.
- **Major:** nenhum no escopo do CTA.
- **Minor:** test suite global não verde nesta branch.
- **Nit:** dependência de `maskImage` para o grid (fallback aceitável em browsers modernos).
