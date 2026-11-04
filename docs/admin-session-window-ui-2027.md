# F2-4: janela administrativa e regra presencial

## Entrega da fase B

Implementacao React sobre a direcao aprovada na fase A. O prototipo em
`docs/design/admin-session-window*` foi preservado. Sem commit, deploy ou mudanca
de SQL, dependencias, generated types ou helper compartilhado de cache.

### Janela da prova

- `editions_ui` habilita a protecao para prova existente vinculada a edicao.
- Contagem positiva ou desconhecida protege as datas no formulario comum; zero
  confirmado permite a edicao normal. Desligar a protecao limpa o pending e
  respostas antigas nao alteram o estado atual.
- Metadados continuam editaveis. `preserveWindow` omite as tres datas apenas no
  UPDATE existente; criacao e chamadas legadas mantem seus contratos.
- O dialogo usa os helpers de Brasilia, valida abertura < fechamento <= resultados,
  exige preview e motivo de 1 a 2000 caracteres. Editar datas invalida o preview.
- Preview/update usam os RPCs `admin_preview_simulado_window` e
  `admin_update_simulado_window`, sem UPDATE generico de fallback. Relatorios e
  contagens sao validados no servico, sem substituir dados ausentes por zero.
- `old_window` exige objeto com tres strings ISO com fuso e parse valido, mas
  permite ordem historica anterior ao CHECK NOT VALID (caso S7: resultados dois
  minutos antes do fechamento). Input e `new_window` continuam exigindo
  abertura < fechamento <= resultados. Counts, hash, id e motivo nao foram relaxados.
- Confirmacao tem singleflight; Escape/fechamento externo nao descartam escrita
  pendente. Hash stale e lock ocupado exigem nova acao explicita.
- P0003, 42501 e HTTP 403 recebem recusa humana. Corrida apos contagem zero
  preserva o rascunho e orienta nova conferencia, sem expor SQL ou nome de RPC.
- Falha ambigua ou retorno de mutacao malformado mantem resultado incerto e
  bloqueiam novo envio, inclusive ao fechar/reabrir. Leitura e preview explicitos
  nao presumem sucesso e nao dispensam revisao autorizada da auditoria.
- Sucesso guarda o relatorio real de update e apresenta `attempts_examined` e
  `eligibility_changed` dele, nunca do preview ou de calculo local. A regressao
  cobre preview com 3 e update com 4 tentativas.
- O callback atualiza funcionalmente somente as tres datas, preserva titulo e
  descricao nao salvos e refaz a contagem local, sem recarregar o simulado.
- `invalidateAdminExamQueries(client)` e chamado uma vez no sucesso para marcar
  os prefixes compartilhados stale sem refetch de aluno. O helper nao foi editado.
- Os tres campos datetime-local do dialogo usam color-scheme light/dark local,
  sem CSS global. Radix preserva foco, Escape e retorno de foco.

### Regra presencial

- `ranking_rule` aceita `legacy_online_window`, `session_window_v1` ou null.
  Campo ausente/incompativel permanece desconhecido; nao se infere legado.
- Chamadas antigas mantem oito argumentos. Somente regra explicitamente fornecida
  adiciona `p_ranking_rule`; nao existe retry descartando o nono argumento.
- Flag desligada nao expoe nem envia regra. Nova sessao com flag ligada prefere
  Janela da sessao; edicao preserva a regra real. Regra desconhecida deixa o
  seletor indisponivel e preserva a politica do servidor ao salvar outros campos.
- A interface informa que a regra vale para novas participacoes e preserva a regra
  registrada das anteriores. Sem mudancas no fluxo de caderno ou processamento.

## Verificacao final

Data: 2026-11-04. Regressao RED confirmada antes das correcoes: flag desligada
mantinha inputs disabled; sucesso nao refazia contagem; status descartava contagens
reais. Os asserts existentes foram preservados e a descricao dirty foi acrescentada.

Comando final apos o ultimo edit de codigo/testes:

```sh
npm run test -- src/admin/services/adminApi.window.test.ts src/admin/services/adminApi.presencial-rules.test.ts src/admin/services/adminApi.editions.test.ts src/admin/components/AdminWindowUpdateDialog.test.tsx src/admin/hooks/useAdminPresencial.test.tsx src/admin/__tests__/AdminSimuladoForm.test.tsx src/admin/__tests__/AdminPresencial.test.tsx
```

Resultado final desta retomada: **7 arquivos e 85 testes passaram**, Vitest 5.1.0,
configuracao padrao, inicio 14:35:49, duracao 13.29s. Os checkpoints anteriores de
77 e 79 testes nao sao o GREEN final. Foram acrescentados seis casos: preview e
update corrigindo S7, dois casos de ISO historico invalido/sem fuso e dois casos
de ordem invalida no input/new (ambos exercitando preview e update).

RED S7 antes da correcao: 2 falhas esperadas em 17 testes do arquivo de janela;
ambos os relatorios eram recusados pela ordem de `old_window`.

```sh
npm run typecheck
```

Resultado: **passou**, `tsc -p tsconfig.app.json --noEmit`, sem diagnosticos.
Os dois TS2352 do dialogo foram corrigidos com objetos de tres propriedades
explicitamente tipados, na inicializacao e na leitura atual, sem any/supressoes
ou alteracao semantica de datas. Nenhum outro handler foi alterado nesta retomada.

### QA visual preservado

O QA abaixo e da rodada anterior (79 testes); nao foi repetido nesta retomada
estrita de TypeScript/validators. Direcao e capturas ja aprovadas, sem redesenho.

```sh
node --test .superpowers/admin-windowQA/react.test.mjs
```

Resultado: **1 teste passou**, duas vistas React reais com fixtures, Edge instalado,
bind 127.0.0.1 e bloqueio de rede externa. Nenhum pageerror ou request externo.
Janela 375 escura: foco inicial/resumo, 15 Tabs contidos, Escape/retorno, Brasilia
independente de Asia/Tokyo. Sessao 1440 clara: default explicito, Escape/retorno.
Os tres datetime-local computam color-scheme dark sob raiz dark; icones claros
visiveis na captura inspecionada. Sem overflow horizontal: pagina 369/375 e dialogo
335/335; pagina 1434/1440 e dialogo 510/510.

Capturas finais (caminhos absolutos):

```text
C:\Users\felipe.souza\Documents\Projetos (Sanar)\enamed-arena\.claude\worktrees\wt\fase1-edicoes-f2-admin-window-ui\.superpowers\admin-windowQA\react-window-375-dark.png
C:\Users\felipe.souza\Documents\Projetos (Sanar)\enamed-arena\.claude\worktrees\wt\fase1-edicoes-f2-admin-window-ui\.superpowers\admin-windowQA\react-session-1440-light.png
```

Fixtures, runner e resumo ficam em `.superpowers/admin-windowQA/` (ignorado).
`git diff --check` passou, com avisos de normalizacao LF/CRLF apenas.

## Limites e handoff

- QA isolado com mocks nao valida backend integrado, permissao real ou producao.
- TypeScript app passou nesta retomada; a checagem final independente permanece
  com o revisor. Lint/build/suite global nao foram executados aqui. O revisor
  informou lint dos 13 arquivos sem erros antes desta retomada.
- Escrita desta retomada limitada ao dialogo, validators de janela em adminApi,
  adminApi.window.test.ts e este documento. Sem novo QA visual ou mudancas de
  SQL/cache/config; sem commit ou integracao.
- Sem rede externa, instalacoes ou leitura de .env. Skill interfaces-com-dende
  carregada; MCP remoto nao consultado pela restricao explicita de rede. Mantidos
  componentes Radix/shadcn e tokens admin existentes, sem alegar migracao Dende.
- Sem download de fonte: fallback de sistema para Plus Jakarta Sans no QA offline.
- Warnings Tailwind de classes ambiguas existentes foram observados no bundle de
  QA; nao foram polidos nem alterados fora do escopo.
- Revisao final e integracao ficam com o revisor. Nenhum commit ou deploy realizado.
