# Banco de Questoes 2027

## Escopo

F4-2 adiciona observacao versionada ao modelo F1 e preserva o motor F0. Nao
altera IDs, answers, AQR, gabaritos, scores, modalidades, snapshots de finish,
RLS/gates existentes, endpoints ou frontend. Nenhum calculo vai para o cliente.
`questions` e `question_options` continuam sendo a fonte materializada do motor.
Inclui reuso explicito de versao em rascunho; nao e uma API de publicacao de provas.

## Modelo

- `question_bank`: uma identidade por questao original independente. Texto igual nao
  funde identidades. `origin_bank_id` e reservado para clonagem explicita futura;
  o backfill nao infere origem entre questoes.
- `question_bank_versions`: payload imutavel, numero sequencial por identidade,
  SHA-256, estado, editor observado e timestamp de observacao. UPDATE, DELETE e
  TRUNCATE sao rejeitados. FKs internas usam RESTRICT, nunca CASCADE.
- `question_bank_usage`: historico de uso por versao/questao/simulado/edicao e
  numero da questao. Apenas um vinculo ativo por questao; substituicoes e
  delecoes arquivam o vinculo anterior. IDs do legado sao informativos, sem FK
  que impecca exclusao antes permitida ou apague o banco versionado.
- `question_bank_private.result_observations`: atribuicao privada do AQR atual
  a uma versao observada. Nao e um novo repositorio de respostas individuais.
- `question_bank_private.materializations`: vinculo privado de cada copia criada
  pelo RPC de reuso com identidade/versao canonica. Nao e inferido por texto ou
  hash e nao pode ser escrito por clientes. O estado `initializing` so existe
  dentro da transacao de materializacao; falhas revertem todas as linhas.

O backfill registra `provenance=legacy_snapshot`, `editor_id=null` e
`observed_at` atual, nunca data de autoria. Ele prova apenas o conteudo observado
na instalacao. Reaplicar nao reescreve snapshots, autores ou timestamps.

O hash usa JSONB canonico, alternativas ordenadas por label com collation C,
conteudo completo (incluindo explicacao/imagens) e formato observado da edicao.
Exclui IDs de alternativas, timestamps e posicionamento. Duas questoes podem
ter hash igual sem compartilhar identidade. Compara-se o hash do uso ativo da
questao, nao a ultima versao global da identidade: no-op semantico nao gera
versao, mas A -> B -> A gera tres versoes. Editar uma copia nao move a fonte ou
outros usos para a nova versao. Numeracao e serializada por identidade com
`FOR UPDATE NOWAIT`; reaplicar o backfill ignora materializacoes explicitas.
URLs de midia sao preservadas, nao os bytes remotos; nao ha promessa de arquivar
objetos externos que sejam substituidos ou removidos.

## Captura e Locks

Triggers AFTER STATEMENT com transition tables capturam uma vez por questao
afetada, depois da mutacao completa daquele statement. Edicoes administrativas
com varios statements podem produzir versoes intermediarias, inclusive validas
estruturalmente; isto nao inventa uma transacao de salvamento da UI.

`incomplete` indica formato/chave incompletos. `published` significa somente
texto/area preenchidos, quantidade exata de alternativas do formato observado,
labels A..N, textos preenchidos e uma unica correta. Nao publica o simulado,
nao libera resultados e nao afirma aprovacao editorial. O snapshot terminal
reproduz o conteudo atual apos statements de questions/question_options.
Mudancas exclusivas no formato da edicao nao disparam uma edicao de questao;
`payload.format` e o formato na observacao, nao uma garantia sobre formato futuro.

Writers de alternativas tomam a trava da questao `FOR UPDATE NOWAIT` antes da
mutacao e mantem o trigger F0/F1 que trava o simulado. Writers de questoes ja
possuem a trava da propria linha. A captura nao toma locks em attempts, users ou
simulados, evitando acrescentar a inversao do reprocessador F2. Isolamento de
escrita suportado: READ COMMITTED. Conflito `55P03` exige retentar a operacao
administrativa inteira; este trabalho nao modifica a UI para retentativa.
Uma espera na mesma linha de alternativa pode ocorrer antes do BEFORE ROW;
o teste em duas conexoes verifica a leitura fresca apos essa espera.

## RPCs e Seguranca

- `admin_list_question_bank(p_search text=null, p_limit integer=50,
  p_offset integer=0)`: exige autenticacao e `content.manage`. Retorna JSONB
  `{items,total,limit,offset}`, independentemente de haver AQR. Busca literal,
  case-insensitive, no texto da ultima versao; ate 500 caracteres. Limite 1..200,
  offset 0..1000000. Ordenacao por observacao decrescente e bank_id, estavel sem
  escritas concorrentes; nao promete snapshot entre paginas de requests distintos.
  `items=[]` preserva `total`, inclusive fora da ultima pagina. Cada item tem
  `bank_id`, `original_question_id`, `origin_bank_id`, `identity_observed_at`,
  `title` (preview textual de ate 180 caracteres, nunca HTML), `latest_version_id`,
  `latest_version_number`, `latest_state`, `observed_at`, `usage_count` (usos ativos).
- `admin_add_bank_version_to_simulado(p_version_id uuid, p_simulado_id uuid,
  p_question_number integer)`: exige autenticacao e `content.manage`. Retorna
  JSONB `{question_id,bank_id,version_id,usage_id,simulado_id,edition_id,question_number}`.
  Argumentos obrigatorios. Destino somente `draft`, sem attempts, numero livre
  entre 1 e `edition.format.questions`. Formato deve ser exatamente igual ao da
  versao, que precisa estar estruturalmente completa. Blueprint obrigatorio e
  area explicita compativel por ID e nome/codigo/alias, sem remapeamento silencioso.
- `admin_list_question_bank_versions(p_bank_id uuid, p_limit int=50,
  p_offset int=0)`: exige usuario autenticado e `content.manage`, retorna versoes
  completas em ordem decrescente. Limite 1..200, offset 0..1000000; bank obrigatorio.
- `admin_get_question_item_analysis(p_bank_id uuid=null,
  p_edition_id uuid=null)`: exige usuario autenticado e `intel.view`. Retorna
  somente agregados por identidade, versao, edicao, treino e proveniencia.

Tabelas novas tem RLS sem policies genericas; nenhum grant de leitura ou escrita
direta para anon/authenticated/service_role. Helpers privados sem EXECUTE ou
USAGE para esses papeis. RPCs SECURITY DEFINER e triggers privilegiados usam
search_path fixo; somente authenticated recebe EXECUTE das quatro RPCs publicas,
com capability checada dentro da funcao. Os writers antigos continuam sujeitos
ao controle `content.manage` ja existente. Nao se usa JWT de staff para consultar
respostas de alunos sem `intel.view`. Tipos manuais em
`src/types/question-bank.ts`, sem editar tipos Supabase gerados.

O reuso cria novos IDs de questao e alternativas, preservando `bank_id` e o
`version_id` escolhido, inclusive uma versao anterior a latest. A inicializacao
privada evita snapshots intermediarios sem desativar triggers F0/F1. A captura
terminal deve coincidir com a versao escolhida; qualquer divergencia desfaz a
operacao inteira. Nao cria attempts, answers, AQR ou scores. Locks com NOWAIT
seguem simulado, edicao/blueprint/area e captura da identidade; conflitos 55P03
exigem retentativa da transacao inteira. Argumentos/destinos incompativeis usam
22023; numero ocupado usa 23505; ausencia de identidade usa 42501; falta de
capability usa P0003. `admin_clone_simulado` nao foi alterado: a clonagem legada
continua criando identidades independentes, sem deducao de origem pelo hash.

## Analise por Item

Inclui apenas AQR de attempts submitted/expired com finished_at e score, em
simulados com results_release_at atingido. `is_training` e o inverso de
is_within_window (null tratado conservadoramente como treino). Modalidade nao
e alterada e nao equivale a treino.

- `n_responses`: numero de AQR, inclusive itens em branco.
- `n_answered`: AQR com was_answered.
- `n_correct`: is_correct E was_answered.
- `difficulty_observed`: n_correct / n_responses, proporcao bruta 0..1, NAO TRI,
  sem calibracao, discriminacao ou promessa de dificuldade psicometrica.

AQR preexistente fica `legacy_unattributed`, com version_id null. Nao atribuir
retroativamente o conteudo atual ao passado. AQR inserido ou semanticamente
reprocessado fica `result_observed`, ligado a versao corrente no registro do
resultado. Isso NAO prova a versao exibida durante a prova. No-op no AQR nao
reatribui a versao. Edicoes posteriores de conteudo nao movem atribuicoes.
Versoes diferentes nunca sao combinadas como identicas mesmo quando o hash
volta a um valor anterior. Reprocessamento que muda AQR atualiza sua atribuicao
atual; nao representa uma serie temporal de scores antigos. Nenhum user_id,
attempt_id, email ou resposta individual sai pela RPC de analise.

Os snapshots sobrevivem a exclusao do legado, mas a analise conta AQR ainda
existentes e elegiveis. Nao preserva AQR apagados por regras legadas de cascade,
nem inventa eventos de tentativa ausentes.

## Validacao Local

Somente `127.0.0.1:54737`, postgres, bancos `enamed_test_bank_*`. Criar copia de
nome unico do template vazio `enamed_test_f1_admin_review_20261104`; nunca apagar
DBs existentes. Confirmar o binario com `Resolve-Path` antes de executar:

```powershell
Resolve-Path "../../fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe"
```

No banco isolado, aplicar o pre-requisito F2
`supabase/migrations/20261104110000_fase2_reprocess.sql` se ausente. Depois:

```text
psql -X -w -h 127.0.0.1 -p 54737 -U postgres -d <enamed_test_bank_nome_unico> -v ON_ERROR_STOP=1 -f supabase/tests/fase4_question_bank.sql
node --test scripts/sql-local/question-bank-concurrency.test.mjs
node scripts/sql-local/question-bank-concurrency.mjs <enamed_test_bank_nome_unico>
```

O SQL cria fixture sintetica de 700 questoes em duas edicoes antes da migracao,
compara o legado byte-a-byte em JSONB, injeta falha tardia na instalacao para
verificar rollback de DDL/backfill/triggers/RPCs, reaplica, testa ABA/no-op, snapshots,
estados parciais, soft archive, capacidades negativas, analise released e
rollback por falha injetada apos captura. Tambem valida listagem sem AQR, busca,
preview, paginas, duas copias em edicoes distintas, edicao local independente,
negativos de permissoes/destino/formato/blueprint e rollback apos alternativas.
A fixture inicial e as copias sinteticas ficam commitadas para validar reaplicacao
com reuso e concorrencia; os testes de falha finais sao revertidos. Usar banco novo
para uma nova execucao completa. O harness de concorrencia deixa pequenas
edicoes sinteticas commitadas como evidencia. Nao roda finalize nem recalcula
scores; chama o RPC F2 real apenas com lock concorrente que o faz falhar antes
de escrever. Nao executa a suite global.

O teste de rollback da instalacao imprime erros SQL esperados: desliga
ON_ERROR_STOP somente para aquela inclusao, comprova via sequencia nao
transacional que chegou a falha tardia, reativa ON_ERROR_STOP e verifica ausencia
dos objetos antes da instalacao definitiva. O event trigger de falha e removido.

Baseline Managed Supabase externo/ACLs reais, aplicacao em ambiente gerenciado,
volume real e revisao humana do diff continuam pendentes. Nenhuma rede ou
producao foi usada para esta validacao.

Evidencia do complemento: `enamed_test_bank_5416_reuse_final`, SQL completo
passando; harness unitario 3/3, concorrencia real 15/15 (inclui NOWAIT no simulado
e na identidade canonica, rollback sem inicializacao pendente e retentativa),
typecheck isolado de `src/types/question-bank.ts` sem erros. Os erros SQL da
injecao de instalacao sao esperados e verificados, nao falhas da suite.

Evidencia local de 2026-11-04: `enamed_test_bank_5416_atomic_20261104`, copia
isolada do template F1 com pre-requisito F2 aplicado. Roteiro SQL concluido com
35 asserts mais os casos de erro esperado; harness com 3 testes unitarios e
11 verificacoes concorrentes aprovados. Typecheck restrito a
`src/types/question-bank.ts` aprovado. Bancos de tentativas anteriores foram
preservados, sem apagar ou reutilizar nomes para encobrir falhas intermediarias.

## Rollback Nao Destrutivo

Em manutencao revisada, desabilitar somente os triggers `bank_00_option_lock`,
`bank_capture_insert/update/delete` em questions/question_options e
`bank_result_observation` em AQR; revogar EXECUTE das duas RPCs. Manter RLS,
immutability, todas as tabelas e dados versionados. Nao restaurar conteudo antigo
nem recalcular resultados. Nenhuma funcao/ACL legada foi substituida; nao ha
checkpoint de DDL legado a restaurar. Se reativar apos lacuna de observacao,
reconciliar explicitamente como nova observacao, sem atribuir autoria historica.
