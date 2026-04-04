# Revisao e Finalizacao ? Modal de Finalizacao de Simulado

## Escopo
Refino premium da modal `SubmitConfirmModal` com foco em clareza, navegacao direta e reducao de redundancia visual.

## Alteracoes aplicadas
- Removidos os cards de metricas de `Em branco` e `Para revisar`.
- Mantidos apenas cards de alto valor imediato: `Respondidas` e `Alta certeza`.
- Adicionado bloco navegavel para questoes `Para revisar` com chips clicaveis para salto direto.
- Mantido bloco navegavel para questoes `Em branco`.
- Preservada acao de navega??o existente: fechar modal e ir direto para a questao.
- Integrado novo `reviewIndices` em `SimuladoExamPage` para alimentar o bloco de revisao.

## Arquivos alterados
- `src/components/exam/SubmitConfirmModal.tsx`
- `src/pages/SimuladoExamPage.tsx`

## Verificacao executada
- `npx tsc --noEmit` ?
- `ReadLints` nos arquivos alterados ? sem erros

## Review pass (severidade)
- Blocker: nenhum
- Major: nenhum
- Minor: nenhum
- Nit: opcional padronizar visual dos chips de navegacao (warning/info) com token compartilhado no futuro.
