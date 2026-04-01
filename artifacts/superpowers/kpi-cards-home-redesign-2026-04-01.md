# KPI cards home (premium) — 2026-04-01

## Mudanças

- Redesenhado `KpiGridSection` em `HomePagePremium.tsx`: layout em coluna (rótulo → valor em destaque → texto de apoio → rodapé com CTA).
- Ícones maiores, seta em chip, brilho de fundo sutil, separador antes do bloco principal.
- Valores numéricos/data com `clamp()` para escala responsiva; área de texto com `line-clamp` e quebras adequadas.
- Novo prop `nextSimuladoTitle` para exibir o nome do próximo simulado no card correspondente.

## Verificação

- `npm run build`: concluído com sucesso.
- `npm run test`: falhas pré-existentes em `DesempenhoPage.test.tsx` (múltiplos nós com o mesmo texto), não relacionadas a este arquivo.

## Revisão (severidade)

- **Nenhum blocker**
- **Minor**: testes de Desempenho com `getByText` frágil quando há texto duplicado na página.
