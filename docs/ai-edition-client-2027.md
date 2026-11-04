# Cliente IA por edicao

## Escopo

O cliente envia contexto aditivo para `gemini-performance-summary`,
`gemini-ranking-summary` e `gemini-comparative-summary`, conforme
`docs/contracts/ai-edition-2027.md` e `src/types/ai-edition.ts`.
Nao calcula score, nao altera tentativas e nao infere proficiencia TRI.

## Resolucao do contexto

- `useAiEditionContext` usa a edicao real da prova, nunca a edicao alvo do aluno.
- Desempenho e Ranking passam a metadata do simulado selecionado. Comparativo
  recebe entries enriquecidas pelos simulados em `ComparativoPage` e preserva
  todos os IDs da serie no payload.
- Com `editions_ui=true`, cada prova precisa de uma edicao resolvida e a serie
  inteira precisa pertencer a uma unica edicao. Metadata ausente, formato
  invalido ou serie mista impedem a geracao, sem fallback global.
- O formato e validado por `validateExamFormat`; nao ha substituto de 100
  questoes, quatro horas ou GOAL50.
- O percentil e o Top X% calculado pelo cliente com `computePercentile`, inteiro
  entre 1 e 99, ou `null`. No Ranking, posicao e populacao usam participantes
  globais, nao a posicao na tabela filtrada. Nao se usa `100 - nota`.
- O servidor continua responsavel por autenticar e validar o contexto contra
  catalogo e dados autorizados. A validacao do cliente nao substitui RLS.

## Flag e referencias de corte

- A flag consultada por `useAppConfig` e a autoridade. Flag pendente ou com erro
  nao equivale a modo legado confirmado e nao habilita consultas globais.
- Com a flag confirmada como falsa, nao se consulta o catalogo de edicoes para
  IA e as chamadas legadas de corte mantem seus argumentos anteriores.
- Com a flag verdadeira, as consultas exigem `referenceEditionId` explicito.
  As RPCs recebem `p_reference_edition_id` e resultados de outra edicao sao
  descartados. A tabela completa tambem filtra por edicao e usa paginacao.
- O label da referencia completa vem de `cutoff_reference_label` no catalogo;
  o badge da prova nao e uma fonte de corte. Sem label, a tabela retorna vazia.
- `cutoffReference` so existe quando todos os matches concordam em edicao,
  label, fonte e valor finito. Ausencia ou divergencia resulta em `null`.
- Sem referencia unica comprovada, o payload IA leva `cutoffContext: null`.
  Fonte D6 nao e fabricada. UI exibe referencia/fonte reais ou indisponiveis.
- Cortes sao informativos: nao ha alegacao de aprovacao, barra de equivalencia,
  diferenca percentual ou sinal de passou/faltou entre escalas nao comprovadas.

## Cache e ciclo de vida

`useAiSummary` centraliza geracao automatica/manual, retry e armazenamento.

- O cache de sessao usa `sanor:v2`, usuario autenticado, tipo de resumo, todos
  os IDs na ordem recebida e representacao JSON canonica dos dados completos.
  Objetos tem chaves ordenadas; arrays preservam a ordem. Nao e hash nem TTL.
- Payload, edicoes, percentil e contexto da referencia participam da chave;
  mudar uma prova intermediaria da serie tambem invalida o resumo.
- Entradas v1, markdown bruto e registros sem envelope v2 nao sao reutilizados.
- Troca de conta/logout remove caches de outras contas quando o hook observa
  a mudanca. Sem usuario nao ha leitura, geracao nem gravacao de resumo.
- Respostas de requisicoes antigas nao pintam nem gravam cache depois de troca
  de chave ou unmount. Nao ha cancelamento HTTP: a resposta e descartada.
- Geracoes simultaneas sao deduplicadas por instancia/chave. Uma falha permite
  retry manual, sem loop automatico. O typewriter usa a chave para nao mostrar
  texto da conta ou prova anterior durante a troca.
- Storage indisponivel ou cheio nao impede a tela; o cache e apenas auxiliar.

## Verificacao

Testes locais usam mocks, sem Supabase/Gemini reais e sem credenciais.

```sh
npm run test -- src/lib/ai-edition-context.test.ts src/lib/profSanCache.test.ts src/services/cutoffApi.test.ts src/hooks/useAiEditionContext.test.tsx src/hooks/useCutoffContext.test.tsx src/hooks/useCutoffScores.test.ts src/components/desempenho/ProfSanorPerformance.test.tsx src/components/desempenho/AIPerformanceSummary.test.tsx src/components/ranking/ProfSanorRanking.test.tsx src/components/comparativo/ComparativoHero.test.tsx src/components/ranking/CutoffScoreModal.test.tsx src/components/ranking/RankingCutoffSection.test.tsx --maxWorkers=2
npm run typecheck
```

Cobertura inclui flag legada/pendente/ativa, formato e edicao, treino historico,
serie mista, percentil real, corte sem fonte, cache legado, mudanca de conta e
de prova durante requisicao, alteracao intermediaria da serie e retry.

Nao fazem parte desta verificacao: chamadas HTTP reais, deploy, dados D6,
validacao visual no navegador, build ou suite global. Componentes existentes
React/shadcn e tokens do projeto foram preservados, sem migracao visual para a
biblioteca Dende. O overview Dende foi consultado; isso nao comprova conformidade
visual ou acessibilidade integral.
