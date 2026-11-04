# Importacao De Questoes Por Edicao

## Contrato E Atomicidade

`admin_import_questions(p_simulado_id uuid, p_rows jsonb)` recebe o contrato
`src/types/question-import.ts` e retorna `{ok, imported, errors}`. `errors.row`
e a posicao 1-based no payload, nao o numero da questao. A tela mostra `row + 1`
para incluir o cabecalho da planilha. Erros preservam os dados locais.

O backend verifica `auth.uid()` e `admin_require('content.manage')`. Falha de
autenticacao/capacidade levanta excecao; nao e erro de conteudo. Nenhum cliente
service-role invoca essas RPCs. O cliente da Edge leva o JWT do operador.

Antes de qualquer INSERT, todas as linhas sao validadas: inteiro positivo dentro
do formato, ausencia de duplicatas no lote e no banco, textos, dificuldade,
alternativas A..Z em ordem, quantidade exigida pelo formato e exatamente uma
correta. O adaptador suporta formatos de 2 a 26 alternativas (labels alfabeticos),
sem assumir 100 questoes ou quatro alternativas. Campos canonicos malformados
nao sao convertidos para texto para esconder erro de tipo.

Area deve corresponder exatamente, apos normalizacao de acento/case/espacos, a
um code/label/alias unico da matriz da edicao do **simulado**. Um `area_id`
fornecido deve corresponder a essa mesma area. Preventiva e compostas ambiguas
nao sao inferidas. O novo hook nao consulta o alvo do aluno nem recua para pesos
legados em caso de falha. Pesos do banco e `weights_provisional` sao preservados;
a tela identifica explicitamente distribuicao ainda nao confirmada.

A importacao so aceita `draft`/`test` sem nenhuma tentativa. A validacao bloqueia
**somente a linha do simulado alvo em FOR UPDATE**, antes da consulta de
tentativas, e mantem esse lock ate o fim da transacao de importacao. Nao ha lock
SHARE da tabela `attempts` em runtime. Edicao, blueprint e areas recebem locks
FOR SHARE durante a validacao/gravacao, nao durante os uploads. Reenvio e
rejeitado; nao ha UPDATE/UPSERT de questoes nem alternativas. O unico UPDATE e
do contador do simulado de destino. Origem e proveniencia nao sao modificadas.

INSERTs de questoes, alternativas, contador e auditoria integram uma unica
transacao PostgreSQL. Uma excecao intermediaria aborta tudo. Auditoria usa
`admin_log_action` e a identidade do operador. A correcao de `tg_admin_audit`
pertence a outro job; nao foi duplicada e o snapshot local revisado ja permite
executar a fixture.

Definicoes **reais do snapshot local** consultadas com `pg_get_functiondef`:
`create_attempt_guarded(uuid)` nao adquire lock no SELECT inicial do simulado;
seu INSERT aciona `enforce_attempt_edition_snapshot()`, que le a linha pai com
`FOR SHARE`. A FK validada `attempts_simulado_id_fkey` tambem requer KEY SHARE
no pai. Ambos conflitam com o FOR UPDATE do importador. Nao foi preciso alterar
guard, trigger, FK, constraints ou ACLs do modelo F1. Tentativas de outros
simulados usam outras linhas e continuam criando/atualizando.

Essa coordenacao exige **READ COMMITTED**: se uma tentativa ja detem o lock pai,
o importador espera e sua consulta seguinte de tentativas recebe um snapshot
novo, vendo o commit que acabou de ocorrer. Em REPEATABLE READ, o snapshot fixo
poderia esconder esse INSERT. Por isso a validacao recusa isolamentos diferentes
de READ COMMITTED com SQLSTATE `25001`, apos autenticar e verificar capacidade.
As duas RPCs permanecem VOLATILE; nao converter a validacao em STABLE/IMMUTABLE.

## Imagens E Recuperacao

A extracao XLSX, stitcher e parser existentes nao foram refatorados. Sao mantidos
os slots enunciado, enunciado2 e comentario e a normalizacao de URLs da tela.
CSV aceita separador virgula/ponto-e-virgula, BOM, aspas, quebras dentro de campos
e URLs; XLSX continua carregando imagens extraidas pelos utilitarios existentes.
Cabecalhos e modelo de alternativas acompanham o formato quando a flag esta ON.
Alternativas extras preenchidas nao sao descartadas silenciosamente.

A tela envia um preflight **somente leitura**, com o lote inteiro, para a mesma
Edge (`validate_only: true`). Somente depois envia imagens diretamente ao
Storage, com quatro workers, sem levar base64 de uma planilha grande ao commit.
O caminho novo e
`<simulado>/imports/<operator-uid>/<batch-uuid>/<numero>_<slot>.<ext>` e usa
`upsert: false`. A migration acrescenta INSERT/DELETE por `content.manage`
apenas no namespace `imports/<auth.uid()>`; nao amplia UPDATE nem altera as
policies legadas. Harness sem `storage.objects` pula apenas essas policies e nao
comprova autorizacao real do Storage.

Ha **uma unica chamada de commit para o lote inteiro**, sem chunks ou gravacao
das linhas consideradas prontas. A RPC valida de novo sob lock, pois o estado
pode mudar entre preflight e commit. Essa validacao adicional tambem protege
clientes que chamam a RPC sem preflight.

Falha conhecida de upload espera todos os workers encerrarem e tenta remover
somente a lista exata de arquivos novos confirmados. Uma resposta de conteudo
`ok:false` do commit permite a mesma limpeza. Falha de transporte no commit e
incerta: os arquivos ficam para reconciliacao, pois o banco pode ter confirmado
o commit. Nenhum prefix-delete nem limpeza de imagens antigas e utilizado.
Falhas da propria limpeza podem deixar arquivos orfaos; devem ser conciliadas
por lista exata. Nao existe transacao distribuida entre Storage e PostgreSQL.

A Edge tambem aceita `images` em base64 para compatibilidade, usando service
role **apenas no Storage**, depois de autenticacao/capacidade e preflight das
linhas. Seu helper tem a mesma politica de limpeza e incerteza no commit.

## Expand E Flag

1. Validar/aplicar F0 e o modelo F1-1, incluindo a correcao separada de auditoria.
2. Aplicar `20261104074245_fase1_question_import.sql`. O preflight de UNIQUE falha
   explicitamente se houver duplicatas; nunca apaga nem renumera dados. A
   migration pode ser reaplicada e contem rollback manual preservando dados.
3. Publicar a Edge compativel antes da nova tela. Ela aceita tanto `rows`
   canonicas quanto `questions` legadas (`numero`, `texto`, `alternativa_a`,
   `correta` etc.), `image_urls` e os tres slots. `inserted` e um campo aditivo
   para consumidores antigos, alem do contrato canonico.
4. Disponibilizar a tela com `editions_ui=false`: nao ha reads novos de
   edicao/blueprint; permanecem validacao/UX legadas de quatro alternativas e o
   corpo portugues no endpoint existente. O preflight de seguranca e o commit
   unico sao mudancas intencionais mesmo com flag OFF; nao ha mais sucesso
   parcial silencioso. Os controles da matriz sao condicionados a flag.
5. Habilitar a flag so apos backfill/revisao da edicao, formato, aliases e pesos.

Clientes antigos em cache podem continuar enviando multiplas requisicoes. Cada
requisicao aceita pela nova Edge e atomica; **nao ha atomicidade entre requests
legados** nem rollback dos chunks anteriores. A UI em cache nao ganha o novo
relatorio por linha e deve ser recarregada para recuperacao assistida. Correcoes
de conteudo publicado seguem outro fluxo auditado, nao este importador.

## Evidencia E Limites

Os testes Vitest restritos cobrem adaptador parametrizado com duas matrizes,
pesos provisorios, 4 versus 5 opcoes, extras nao descartados, numeracao/areas,
CSV, fluxo da Edge, API de lote unico, hook desligado/erro/retry e tela com
relatorio focado, preservacao de dados e tres slots/limpeza exata. Os testes
existentes de `validateQuestions` permanecem no mesmo arquivo e sao executados.

Resultado da primeira rodada: 44 testes passando em sete arquivos e checagem
TypeScript programatica do escopo sem diagnosticos. A revisao de locks abaixo
ampliou os testes restritos para **61 passando, zero falhando, em dez arquivos**,
incluindo todos os testes existentes de `xlsxImageExtractor`, `stitchImages` e
`downscaleImage`, sem altera-los. Nao existe teste dedicado de `xlsxTextParser`
neste checkout; o teste de tela usa mock do parser. Nao se afirma cobertura real
nova desse parser. JSDOM emite avisos esperados de canvas indisponivel nos testes
do fallback do stitcher; os casos passam. ESLint restrito e `git diff --check`
passaram. Nao foram rodados suite global, tsc completo ou build nesta revisao;
Codex fara essas verificacoes. Verificacao Deno da entrada Edge tambem pendente.

### Revisao Independente Informada

Em 04/11/2026, Felipe informou que **Codex**, em revisao independente, aplicou
a migration e executou a fixture original com **exit 0** em
`127.0.0.1:54737/enamed_test_f1_import_review_20261104`. Essa evidencia antecede
a correcao de locks e nao e apresentada como execucao propria nem como prova
de ausencia de bloqueio global.

### Revisao De Locks Executada Neste Job

Foi usado o **mesmo banco descartavel** acima, com dois processos psql reais e
sem alterar o guard de outro job. Antes de qualquer mutacao, o harness verifica
host/porta/user/nome allowlisted e confirma `inet_server_addr`,
`inet_server_port`, `session_user` e `current_database` no servidor. Variaveis
PG de ambiente sao descartadas; `-X -w` evita rc e prompts de senha. Dados de
concorrencia usam UUIDs proprios; cleanup remove somente esses IDs sinteticos.

TDD observado: o harness de seguranca falhou inicialmente por modulo ausente;
antes da correcao SQL, o ensaio real falhou ao observar que uma tentativa em
**outro** simulado esperava o importador. A fixture com os novos testes de
isolamento tambem falhou na versao antiga, com `Simulado not found` em vez da
recusa explicita de REPEATABLE READ. Depois da correcao:

- Migration revisada aplicada e reaplicada com exit 0, sem remover UNIQUE/ACLs.
- Fixture atualizada: **22 asserts PASS**, exit 0. Inclui os casos originais,
  grants authenticated, bloqueio anon/PUBLIC, UNIQUE preservada e rejeicao de
  REPEATABLE READ/SERIALIZABLE. Todas as transacoes da fixture terminam em rollback.
- Harness Node de seguranca: **2 testes passando**, exit 0.
- Ensaio concorrente: **20 verificacoes logicas**, exit 0, repetido com sucesso.
- Inspecao final confirmou ambas as RPCs VOLATILE, zero usuarios sinteticos
  residuais deste harness/fixture e ausencia do trigger temporario de falha.
- INSERT e UPDATE guardado de tentativa em outro simulado terminaram enquanto
  a transacao do importador ainda estava aberta.
- Importador primeiro: criacao guardada no alvo esperou; antes do commit havia
  zero tentativas, depois a tentativa criou e enxergou as quatro alternativas.
- Tentativa primeiro: importador esperou o lock pai; apos commit da tentativa,
  o mesmo comando RPC recusou o lote e havia zero questoes no alvo.
- INSERT direto confiavel como postgres, apenas nos IDs sinteticos, tambem
  esperou o lock pai; apos rollback do importador criou, com zero questoes.

As barreiras exigem `pg_stat_activity.wait_event_type='Lock'`,
`pg_blocking_pids` identificando o outro processo e um lock nao concedido em
`pg_locks`. Nenhum sleep fixo e usado como prova; ha polling limitado a 4s,
statement timeout de 6s e lock timeout de 5s. O pacing de polling e apenas 10ms.

Comandos executados a partir deste worktree (cada comando terminou com exit 0
apos a correcao; as falhas TDD anteriores estao descritas acima):

```powershell
$psql = '../../fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe'
$connection = 'host=127.0.0.1 port=54737 dbname=enamed_test_f1_import_review_20261104 user=postgres passfile=NUL'
# O comando de aplicacao tambem executou um DO de allowlist no servidor ANTES do -f.
& $psql -X -w $connection -v ON_ERROR_STOP=1 -c "DO 'BEGIN IF current_database() <> ''enamed_test_f1_import_review_20261104'' OR inet_server_addr() IS DISTINCT FROM ''127.0.0.1''::inet OR inet_server_port() IS DISTINCT FROM 54737 OR session_user <> ''postgres'' THEN RAISE EXCEPTION ''Unsafe local target''; END IF; END';" -f supabase/migrations/20261104074245_fase1_question_import.sql -f supabase/tests/fase1_question_import.sql
node --test scripts/sql-local/import-concurrency.test.mjs
node scripts/sql-local/import-concurrency.mjs enamed_test_f1_import_review_20261104
node node_modules/vitest/vitest.mjs run src/lib/enamedBlueprint.test.ts src/admin/lib/validateQuestions.test.ts supabase/functions/admin-upload-questions/import.test.ts src/services/blueprintsApi.test.ts src/admin/services/adminQuestionImportApi.test.ts src/hooks/useEditionBlueprint.test.tsx src/admin/__tests__/AdminUploadQuestions.test.tsx src/admin/utils/xlsxImageExtractor.test.ts src/admin/utils/stitchImages.test.ts src/admin/utils/downscaleImage.test.ts
node node_modules/eslint/bin/eslint.js --no-ignore src/admin/pages/AdminUploadQuestions.tsx src/admin/__tests__/AdminUploadQuestions.test.tsx src/admin/services/adminQuestionImportApi.ts src/admin/services/adminQuestionImportApi.test.ts src/admin/lib/validateQuestions.ts src/admin/lib/validateQuestions.test.ts src/lib/enamedBlueprint.ts src/lib/enamedBlueprint.test.ts src/hooks/useEditionBlueprint.ts src/hooks/useEditionBlueprint.test.tsx src/services/blueprintsApi.ts src/services/blueprintsApi.test.ts supabase/functions/admin-upload-questions/index.ts supabase/functions/admin-upload-questions/import.ts supabase/functions/admin-upload-questions/import.test.ts scripts/sql-local/import-concurrency.mjs scripts/sql-local/import-concurrency.test.mjs
git diff --check
```

O ESLint do projeto nao aplica regras recomendadas a `.mjs`; os dois arquivos
do harness tambem foram verificados pela API ESLint com `@eslint/js` recommended
e `globals.node`, retornando **zero erros**, exit 0.

Pendentes do orquestrador: ensaio em **Storage gerenciado Supabase**, incluindo
ACLs reais de upload/delete e reconciliacao de falhas, execucao em browser dos
extratores/canvas e inspecao visual/teclado a 375px. A fixture PostgreSQL local
possui `storage.objects` (as policies SQL puderam ser reaplicadas), mas nao
certifica o servico Storage gerenciado nem transacao distribuida. JSDOM verifica foco e
semantica, nao layout/overflow real. Nenhum efeito novo de movimento foi criado;
os componentes/tokens admin existentes foram preservados. Consulta remota ao
Dende, navegador com servicos reais, deploy e producao ficaram fora pela
restricao de rede. Nao ha alegacao de certificacao visual ou de acessibilidade.
