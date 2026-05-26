## Objetivo
Corrigir o travamento ao baixar o PDF dos simulados, movendo a geração pesada da Prova Revisada para a infraestrutura já existente no Supabase e deixando o cliente responsável apenas por iniciar, acompanhar o status e baixar o arquivo pronto.

## O que vou fazer
1. Atualizar o fluxo de `usePdfDownload` para usar a Edge Function `generate-exam-pdf` no download da Prova Revisada, em vez de renderizar o PDF completo no browser com `@react-pdf/renderer`.
2. Manter o `gabarito` leve como está hoje, já que ele usa `jsPDF` e não é o ponto de travamento.
3. Ajustar os componentes que exibem o estado do botão (`Resultado`, `Correção`, `Desempenho`) para refletirem o novo fluxo assíncrono com mensagens claras de progresso e erro.
4. Adicionar tratamento de fallback: se a geração remota falhar, mostrar erro amigável sem congelar a página.
5. Validar o fluxo com teste direcionado e revisão do comportamento nos componentes que disparam o download.

## Resultado esperado
- O botão de PDF não congela mais a aba.
- O usuário vê estado de carregamento realista enquanto o arquivo é preparado.
- O download acontece a partir de um arquivo pronto, em vez de renderização pesada no navegador.
- Em caso de falha, a interface continua responsiva e informa o que houve.

## Detalhes técnicos
- Arquivos principais envolvidos:
  - `src/hooks/usePdfDownload.ts`
  - `src/services/offlineApi.ts`
  - `src/components/desempenho/DesempenhoSimuladoPanel.tsx`
  - `src/pages/CorrecaoPage.tsx`
  - possivelmente `src/pages/ResultadoPage.tsx` se houver CTA relacionado
- Base da correção:
  - Hoje a Prova Revisada usa `src/lib/pdf/provaRevisadaPdf.ts` + `@react-pdf/renderer` + fontes remotas + imagens.
  - Já existe `supabase/functions/generate-exam-pdf`, criada para lidar com limites e custo de CPU fora do cliente.
- Estratégia:
  - Reaproveitar o contrato da Edge Function existente para iniciar a geração e baixar via URL retornada.
  - Preservar analytics e toasts.
  - Evitar regressão no PDF leve (`gabarito`).

## Riscos controlados
- Se a function exigir payload específico, vou alinhar o cliente ao contrato atual em vez de reinventar lógica.
- Se houver polling/lock remoto, a UI vai refletir isso sem loops agressivos nem travamento local.