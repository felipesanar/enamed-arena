# Review Pass ? Escada no Como Funciona (2026-04-02)

## Blocker
- Nenhum.

## Major
- Nenhum.

## Minor
- A escada usa offsets fixos at? `7.5rem`; em resolu??es desktop muito estreitas pr?ximas de `lg`, a densidade visual aumenta, mas sem clipping devido ao `lg:w-[calc(100%-7.5rem)]`.

## Nit
- Coment?rio inline foi adicionado no map dos steps para explicar a l?gica de escada.

## Conclus?o
- Implementa??o est? est?vel, responsiva e mant?m o fallback linear no mobile.
