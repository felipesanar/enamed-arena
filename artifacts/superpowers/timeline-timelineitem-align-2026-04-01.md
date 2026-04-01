# Timeline: TimelineItem + alinhamento geométrico

## Feito
- `TimelineItem` passou a usar `TIMELINE_THEME` (cards com borda em gradiente `shell`/`inner`, sombras, ícone em chip, rail e nó alinhados ao eixo da coluna em `17px`).
- Trilho horizontal: `left`/`width` com `calc(27px - 2.75rem)` e variantes `sm:` para `3rem`, alinhado ao padding da lista.
- Nó: `left-[calc(17px-2.75rem)]` + `-translate-x-1/2` (e `sm:`) para centralizar na coluna.
- Hover 3D via `framer-motion` quando `reduced` é falso; removida checagem `window`.
- Removida opacidade 0.6 em `available_late`.

## Verificação
- `npm run build` — OK
- `npm run test -- --run` — 7 arquivos, 44 testes OK
