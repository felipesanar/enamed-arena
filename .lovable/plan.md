## Objetivo

No modo de imagem ampliada (lightbox) do `QuestionImage`, permitir dar zoom na imagem. Hoje o lightbox só mostra a imagem maior, sem zoom/pan.

## Onde

`src/components/exam/QuestionImage.tsx` — componente único reutilizado na prova, correção, caderno e recall. A melhoria vale para todos esses contextos automaticamente.

## O que será feito

Adicionar zoom interativo dentro do lightbox já existente:

- **Estado de zoom**: `scale` (1x → 4x) e `offset` (deslocamento x/y para pan).
- **Controles visuais**: botões flutuantes de + (zoom in), − (zoom out) e "resetar zoom", além do botão de fechar já existente.
- **Scroll/trackpad**: roda do mouse com zoom centrado no cursor.
- **Pinch (mobile/trackpad)**: gesto de pinça para ampliar.
- **Arrastar (pan)**: quando ampliada (scale > 1), arrastar move a imagem; cursor vira `grab`/`grabbing`.
- **Duplo clique**: alterna entre 1x e 2x.
- Ao fechar o lightbox, o zoom reseta para 1x.

Comportamento fora do lightbox (thumbnail clicável com `ZoomIn`) permanece igual.

## Detalhes técnicos

- Aplicar `transform: scale(...) translate(...)` na `motion.img`, com `transformOrigin` adequado, mantendo a animação de abertura atual.
- `onWheel` com `preventDefault` para evitar scroll da página; clamp do scale entre 1 e 4.
- Pan via handlers `pointerdown`/`pointermove`/`pointerup`; pinch via dois pointers ativos.
- Impedir que o clique no backdrop feche quando o usuário está arrastando/zoomando a imagem (já há `stopPropagation` no `onClick` da img; estender para os gestos).
- Sem novas dependências — implementação manual leve. (Alternativa descartada: instalar `react-zoom-pan-pinch`, evitada para não adicionar dependência.)

## Verificação

- Build/typecheck.
- Teste manual no preview via Playwright: abrir uma questão com imagem na prova, abrir o lightbox, validar zoom por botões, scroll, duplo clique e pan, e reset ao fechar.