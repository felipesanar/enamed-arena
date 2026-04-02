

# Exibir todos os simulados na timeline (incluindo o ativo)

## Problema

O `timelineItems` no `SimuladosPage.tsx` exclui o simulado que aparece como HeroCard (`s.id !== heroId`). O Simulado 1, que está em janela de execução, aparece apenas no HeroCard e não na timeline abaixo.

## Solução

**Arquivo:** `src/pages/SimuladosPage.tsx` (linhas 46-57)

Remover o filtro `s.id !== heroId` do `timelineItems`, incluindo todos os simulados na lista. O simulado ativo já recebe destaque visual na timeline (borda primary, ring, shadow) graças à lógica existente no `TimelineItem`.

Ordenação: colocar simulados ativos/em andamento primeiro, depois os finalizados (mais recente primeiro), depois os upcoming (mais próximo primeiro).

Nenhuma alteração necessária no `SimuladosTimelineSection.tsx` — o destaque visual para `available`/`in_progress` já existe.

