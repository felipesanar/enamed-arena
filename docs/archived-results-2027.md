# Historico Arquivado

## Contrato

Arquivar um simulado nao apaga o historico nem autoriza iniciar/retomar uma prova.
A leitura de metadata F1 continua aceitando qualquer tentativa propria, mas o
conteudo arquivado exige identidade autenticada, tentativa propria `submitted` ou
`expired`, `finished_at` preenchido, inicio da execucao e liberacao dos resultados
atingidos pelo relogio do servidor. Datas nulas falham fechadas.

Esta correcao altera somente duas policies SELECT e seis RPCs de leitura:

- `questions.fase0_questions_release`: inclui historico arquivado com os gates acima; preserva leitura de prova publicada/test iniciada e `content.manage`.
- `question_options`: nenhuma alteracao, herda `questions` pela policy F0. Dependencia unidirecional, sem recursao RLS.
- `attempt_question_results`: mantem `results.view` existente; na leitura propria exige status de simulado publicado/test/arquivado, tentativa finalizada e ambos os gates temporais. Nao concede acesso a resultados de outro aluno.
- `get_question_explanations(uuid)`: acrescenta `archived` ao filtro F0; preserva autenticacao, tentativa propria finalizada, datas e bypass administrativo existente.
- `get_area_score_history`, `get_user_attempt_behavior_stats`, `get_confidence_calibration`, `get_caderno_pattern_data`, com `p_edition_id`: mantem filtros de owner e de edicao e acrescenta historico arquivado liberado. Cache de caderno sem tentativa propria finalizada nao autoriza historico arquivado.
- `get_ranking_for_simulado`: caller com tentativa propria finalizada pode consultar a mesma populacao anteriormente publicada, sem filtrar o ranking somente ao caller. Caller sem tentativa finalizada nao atravessa a fence de metadata F1, mesmo sendo administrador de conteudo. Inicio e liberacao sao obrigatorios.

Nenhuma permissao de coluna e concedida. `explanation`, `explanation_image_url`
e `question_options.is_correct` continuam indisponiveis por SELECT direto, inclusive
para JWT de administrador. `admin_get_simulado_questions` continua sendo o caminho
administrativo para conteudo restrito; nenhuma RPC administrativa e alterada.

## Fontes E Preservacao

Fontes primarias: migrations `20261104054334_fase0_question_release.sql` e
`20261104065001_fase1_edition_model.sql`. No clone de
`enamed_test_f1_target_review_20261104`, foi aplicada a migration F2 do proprio branch,
`20261104092049_fase2_analytics_scope.sql`, antes da nova migration.
As seis definicoes reais foram consultadas com `pg_get_functiondef`; nao foi usado
catalogo JSON anterior a F0 nem o checkpoint original pre-F2 para reconstruir RPCs.

A migration `20261104115401_fase1_archived_result_read.sql` modifica as definicoes
atuais com substituicoes estreitas e contagem esperada de ocorrencias (2 para
historico por area, 8 para padroes, 1 nas demais). Uma definicao inesperada aborta
o unico bloco DO atomico. Nenhuma assinatura e removida ou criada em paralelo.
`CREATE OR REPLACE` preserva owner/ACL, SECURITY INVOKER de behavior stats e todos
os guards preexistentes, inclusive gates PRO quando presentes no corpo de origem.
Nao cria helper publico de autorizacao.

Permanecem inalterados best attempt, desempates por nota/data/ID, dedup, snapshots
de edicoes `closed`/`archived`, semantica cumulativa de submetidas e as condicoes
originais de treinamento. A edicao explicita continua restrita a sua particao.
Nao ha alteracao em tentativas, respostas, notas, snapshots, finalizadores,
criacao, reprocessamento, RPCs operacionais do caderno ou flags de edicao.

## Checkpoint E Rollback

`archived_read_private.checkpoints` guarda somente definicoes, nunca dados de
alunos. Schema/tabela sem acesso PUBLIC/anon/authenticated/service_role e RLS
habilitada sem policies. Ha oito entradas: seis funcoes e duas policies.
Os checkpoints originais nunca sao sobrescritos. Uma entrada ja aplicada e
ignorada em reaplicacoes, preservando ajustes posteriores de corpos e policies.

O rollback manual comentado no final da migration foi reproduzido no teste, dentro
de transacao descartavel. Deve ser executado apenas por manutencao privilegiada:

1. Revisar dependencias e definicoes atuais, e iniciar uma transacao.
2. Executar integralmente o bloco comentado `DO $rollback$`, sem remover a primeira passagem de verificacao.
3. A verificacao exige igualdade com `applied_definition`, inclusive metadados de policy (roles/permissividade/comando). Qualquer ajuste posterior aborta antes de restaurar qualquer objeto e exige merge manual.
4. Restaurar definicoes originais, marcar entradas como nao aplicadas e manter os checkpoints. Confirmar somente depois da revisao dos gates.

O rollback restaura F0/F1/F2 imediatamente anteriores, inclusive o defeito de
invisibilidade de conteudo arquivado e a policy AQR anterior, menos restritiva
quanto a finalizacao/inicio. Nao restaura SELECT de gabarito/comentarios anterior
a F0 nem remove os gates temporais da RPC F0. Nao deve ser usado como substituto
de uma correcao forward de seguranca. Owner e ACL das RPCs nao sao alterados pela
ida/volta; ajustes de grants posteriores nao sao reescritos. Nao usa CASCADE,
DROP SCHEMA ou operacao sobre dados do aluno.

Reaplicar depois do rollback exige a definicao original exata; divergencias
abortam para revisao. O teste valida rollback, reaplicacao, checkpoints intactos,
recusa de rollback sobre ajuste posterior de funcao e de metadados de policy,
e preservacao de owner/ACL/SECURITY INVOKER.

## Execucao Local

Somente PostgreSQL em `127.0.0.1:54737`, usuario de sessao `postgres`. Foram criados
os clones proprios `enamed_test_archived_18e0` e `enamed_test_archived_18e0_final`
do template autorizado; nao foram apagados. Nenhum dado de producao ou acesso
externo. O teste usa `SET LOCAL ROLE authenticated` e claims reais, alem de `anon`.
Fixtures, alteracoes temporarias de constraints/triggers e lifecycle completo
sao revertidos por `ROLLBACK`.

Comandos executados a partir deste worktree (PowerShell, `$psql` abaixo representa
o executavel local autorizado; nao depende de instalacao ou credenciais externas):

```powershell
$psql = "..\..\fase0-2027\.superpowers\editions\pg17-1260616\pgsql\bin\psql.exe"
$db = 'enamed_test_archived_18e0_final'
# Antes de CREATE DATABASE, validar host/porta/database/session_user em postgres.
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT 1/((inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737 AND current_database()='postgres' AND session_user='postgres')::int);" -c "CREATE DATABASE enamed_test_archived_18e0_final TEMPLATE enamed_test_f1_target_review_20261104;"
# O nome deve ser novo em cada reproducao; nao recriar/apagar clone existente.
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d $db -v ON_ERROR_STOP=1 -c "SELECT 1/((inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737 AND current_database()='enamed_test_archived_18e0_final' AND session_user='postgres')::int);" -f supabase/migrations/20261104092049_fase2_analytics_scope.sql
& $psql -X -A -t -h 127.0.0.1 -p 54737 -U postgres -d $db -v ON_ERROR_STOP=1 -c "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('get_question_explanations','get_area_score_history','get_user_attempt_behavior_stats','get_caderno_pattern_data','get_confidence_calibration','get_ranking_for_simulado');"
# RED, antes da nova migration (primeiro clone): exit 1, ASSERT published -> archived.
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d $db -v ON_ERROR_STOP=1 -f supabase/tests/fase1_archived_result_read.sql
# GREEN: validar novamente a identidade da conexao antes da migration.
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d $db -v ON_ERROR_STOP=1 -c "SELECT 1/((inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737 AND current_database()='enamed_test_archived_18e0_final' AND session_user='postgres')::int);" -f supabase/migrations/20261104115401_fase1_archived_result_read.sql -f supabase/tests/fase1_archived_result_read.sql
```

O teste e autocontido apos F2 e a nova migration; inclui a migration por `\ir`
nos passos de reaplicacao. Sua propria guarda rejeita qualquer destino fora de
`enamed_test_archived_%` no host/porta/usuario autorizados.

## Evidencias E Limites

- RED observado no primeiro clone: exit 1 no ASSERT de preservacao `published -> archived`, depois de validar a baseline publicada.
- GREEN observado nos dois clones: exit 0, mensagem `PASS archived result read: all assertion groups completed; fixtures rolled back`.
- O roteiro final contem 76 instrucoes ASSERT, varias repetidas em loops, alem de leituras negadas capturadas por `insufficient_privilege`: um roteiro SQL completo aprovado, zero falhas na execucao final.
- A validacao final cobre questoes/options/correcao/AQR, quatro analises com edicao e cumulativas, ranking/dedup/desempates e snapshots, owner submitted e owner somente expired.
- Casos negativos: outro usuario sem tentativa, in-progress, offline pending, submitted sem finished_at, identidade vazia, anon, draft, release futura/nula e inicio futuro/nulo. Cache de caderno nao autoriza analise arquivada; metadata F1 any-attempt permanece legivel.
- A mesma prova e comparada integralmente antes/depois de arquivar. Tentativas (incluindo score/status/finished_at/snapshots), respostas e resultados sao comparados por JSONB antes/depois e depois do lifecycle.
- Admin JWT nao consegue SELECT das tres colunas restritas e continua lendo pela RPC administrativa; origem `test` da RPC F0 e preservada. Criacao e retomada de archived continuam rejeitadas pela RPC original.
- O desenvolvimento encontrou uma contagem de ranking incorreta na fixture inicial e um erro de sintaxe no guard de contagem de substituicoes; ambos foram corrigidos antes da execucao final verde.
- Nao foram executados suite global, frontend, testes de carga, jobs de reprocessamento nem deploy. Nenhum commit. Revisao do orquestrador e aplicacao em ambientes nao descartaveis ficam fora desta execucao.
