# Caderno Paginado (F2-7)

## Contrato

- `list_error_notebook_page(p_edition_id uuid default null, p_limit integer default 50, p_offset integer default 0) returns jsonb`: `{items, total, limit, offset}`. `total` vem de `COUNT(*)` no PostgreSQL, antes de `LIMIT/OFFSET`; nao depende do teto de linhas do PostgREST.
- Cada item preserva todas as colunas de `error_notebook` e acrescenta `edition_id`, `edition_code`, `edition_label`, via `questions -> simulados -> exam_editions` ou via simulado direto. Os tres campos sao JSON null em entradas manuais sem vinculo. Nenhum ano, alvo, titulo ou sequence_number e usado para inferir uma edicao.
- `get_error_notebook_counts(p_edition_id uuid default null) returns jsonb`: `{total, mastered, due, by_area}`. `by_area` e uma lista ordenada por area (null por ultimo), com `{area, total, mastered, due}`; preserva area null, sem inventar classificacao. Todos os contadores sao do escopo completo, nao de uma pagina.
- `mastered`: apenas `mastered_at IS NOT NULL`. `resolved_at` nao significa dominio automatico. `due`: `mastered_at IS NULL AND resolved_at IS NULL AND coalesce(srs_due_at,next_review_at,created_at)<=now()`. O agendamento SRS prevalece sobre o legado; na ausencia dos dois, vale a data de criacao.
- Limite de 1 a 100, default 50; offset nao negativo, default 0. Null explicito/invalido nesses parametros gera SQLSTATE `22023`, nao clamp silencioso. Ordem `created_at DESC,id DESC`. Offset no fim ou alem retorna `items: []` sem perder `total`.

## Seguranca E Escopo

As duas RPCs usam o mesmo helper `notebook_page_scope(uuid)`. Ele e SECURITY DEFINER, com search_path fixo e referencias qualificadas, sem EXECUTE para PUBLIC, anon, authenticated ou service_role. As RPCs publicas permitem EXECUTE somente a authenticated, alem do owner de migracao. Nao ha parametro de usuario nem overload para service impersonation.

O helper exige `auth.uid()` nao nulo, `auth.role()='authenticated'` e perfil atual `profiles.segment='pro'`; tambem rejeita o role de sessao anon/service_role. JWT com segmento PRO, identidade administrativa ou capability de conteudo nao promove o perfil atual. Rebaixamento do perfil revoga o acesso na proxima leitura. Mesmo um grant acidental futuro a service_role nao permite ler fingindo ser aluno.

Lista e contagens sempre excluem outro owner e soft-delete. Null no filtro significa cumulativo, incluindo manual sem questao/simulado. Filtro explicito exige edicao igual ao vinculo real; desconhecido retorna vazio, sem fallback. Questao e simulado conflitantes sao excluidos, inclusive no cumulativo. Vinculos somente por questao ou somente por simulado sao reconhecidos.

Entradas vinculadas exigem inicio e results_release_at ja alcancados, tentativa do proprio caller submitted/expired com finished_at e status published/archived, ou test somente com `has_capability('content.manage')`. Archived preserva o aprendizado historico do owner conforme F1; test respeita a visibilidade real de simulados e questoes. Treino finalizado e liberado permanece incluido (`is_within_window` nao filtra aprendizado). Rascunho, prova ainda nao liberada e prova sem tentativa finalizada nao expoem nem contagem nem caches de alternativas/correcao. Capability nao dispensa PRO, owner, tentativa ou release. A paginacao nao altera gates antigos nem as RPCs de mutacao/reprocessamento de F2-5.

Nao ha UPDATE/DELETE/backfill de entradas, recalculo de SRS ou resolucao automatica. Os indices parciais adicionados sao `(user_id,created_at DESC,id DESC)` e `(user_id,simulado_id)`, ambos com `deleted_at IS NULL`.

## Validacao Local

Executado exclusivamente em `127.0.0.1:54737`, session_user postgres, clone proprio `enamed_test_notebook_20261104_78af` de `enamed_test_f1_target_review_20261104` (F0 + modelo + target). Nao houve instalacao, rede externa, leitura de segredos, alteracao de migrations anteriores, commit ou deploy.

Binario usado:

```powershell
$psql = 'C:\Users\felipe.souza\Documents\Projetos (Sanar)\enamed-arena\.claude\worktrees\fase0-2027\.superpowers\editions\pg17-1260616\pgsql\bin\psql.exe'
```

Antes de criar o clone, a conexao de manutencao confirmou host/porta/database/session_user e executou a guarda abaixo, com ON_ERROR_STOP. CREATE DATABASE e um comando separado, fora de transacao:

```sql
SELECT 1/((inet_server_addr()='127.0.0.1'::inet
 AND inet_server_port()=54737 AND current_database()='postgres'
 AND session_user='postgres')::int);
CREATE DATABASE enamed_test_notebook_20261104_78af
 TEMPLATE enamed_test_f1_target_review_20261104;
```

Comandos do ciclo TDD (somente este teste):

```powershell
# RED antes de existir a migration: erro esperado "RED: notebook page RPC missing".
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_notebook_20261104_78af -v ON_ERROR_STOP=1 -f supabase/tests/fase2_notebook_pages.sql

# Aplicacao somente depois da guarda de conexao no mesmo processo.
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_notebook_20261104_78af -v ON_ERROR_STOP=1 -c "SELECT 1/((inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737 AND current_database() LIKE 'enamed_test_notebook_%' AND session_user='postgres')::int);" -f supabase/migrations/20261104103000_fase2_notebook_pages.sql -f supabase/tests/fase2_notebook_pages.sql

# GREEN final: todas as assercoes passaram, fixtures revertidas por ROLLBACK.
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_notebook_20261104_78af -v ON_ERROR_STOP=1 -f supabase/tests/fase2_notebook_pages.sql

# Negativo da guarda: erro esperado division by zero ANTES de BEGIN/mutacao.
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/tests/fase2_notebook_pages.sql
```

Resultado: um roteiro SQL final passando, zero assercoes falhando. As saidas RED/guarda sao falhas deliberadas com ON_ERROR_STOP (psql retorna 3 para erro de script); GREEN termina com sucesso (0). Durante a construcao, houve tambem uma falha de fixture por CASE textual no enum simulado_status, corrigida com cast explicito antes do GREEN.

Cobertura exercitada:

- 1500 INSERTs reais visiveis: 700 edicao A, 700 edicao B em treino, 100 manuais; mais seis controles invisiveis. Todos os created_at visiveis iguais para exigir desempate por UUID.
- COUNT 1500 versus pagina default 50; 30 paginas, 1500 IDs distintos em ordem, ultimo item, offset no fim e muito alem; limites 1/100 e cinco entradas invalidas.
- Filtros A/B/inexistente alteram lista e contagens juntos; soma de by_area sempre bate com o total. Campos reais de code/label/id, null manual e vinculos so por questao/simulado.
- Mastered 10 e due 1380: resolved_at sem dominio, SRS vencido versus next_review_at futuro, fallback legado vencido e fallback sem data.
- Outra identidade PRO ve so sua entrada; guest/standard sao negados mesmo com claim PRO; restaurar perfil PRO restaura leitura. Null uid, anon, service com sub de aluno, helper privado e ausencia de EXECUTE PUBLIC sao verificados. Service tambem e negado com grants temporarios deliberados.
- Unreleased/draft/sem tentativa/mismatch/deleted nao entram. Liberar a prova no PG adiciona imediatamente uma entrada e o cache de correcao ao JSON; reverter a liberacao restaura o escopo. Janela futura exclui a edicao.
- Reaplicacao da migration dentro da transacao de fixtures e comparacao integral `to_jsonb(error_notebook)` antes/depois: dados intactos, incluindo notas/caches/datas/SRS. O teste termina com ROLLBACK.

`EXPLAIN (ANALYZE,BUFFERS)` da consulta basica por owner/soft-delete/ordem/LIMIT 50 usou Index Only Scan em `idx_notebook_page_owner_created`, 50 linhas, 6 shared hits, 50 heap fetches, execution time local 0.186 ms na validacao inicial. No primeiro GREEN da revisao de status: mesmo indice, 50 linhas, 5 shared hits, 50 heap fetches, 0.390 ms. Nao e benchmark de carga nem plano completo das RPCs: o helper materializa o escopo autorizado e a RPC calcula COUNT total antes de paginar; offset alto continua tendo custo. Paginacao offset nao promete snapshot entre chamadas concorrentes com novas entradas. Nao houve teste HTTP/PostgREST ou suite global, que ficam com o orquestrador.

## Reaplicacao E Rollback

A migration inteira e um unico DO atomico, inclusive se o runner ja abriu uma transacao. CREATE OR REPLACE FUNCTION e CREATE INDEX IF NOT EXISTS permitem reaplicar; ACLs sao restabelecidas. Nenhum COMMIT interno pode persistir fixtures de teste. O rollback manual comentado no fim da migration remove somente as tres funcoes e os dois indices novos, sem tocar nos dados. O clone local foi preservado para revisao; fixtures nao permanecem nele.

Consulta independente apos o teste confirmou zero entradas e zero usuarios com os UUIDs de fixture. O catalogo confirmou SECURITY DEFINER e search_path fixo nas tres funcoes, EXECUTE apenas para postgres no helper e apenas postgres/authenticated nas duas RPCs.

## Revisao De Status

Revisao F2-7 corrigiu apenas o predicado de status do helper, acrescentou regressoes neste mesmo teste e atualizou este documento. Nenhuma policy/F0/F1 ou outra RPC foi alterada.

Evidencia inspecionada diretamente no catalogo do clone (`pg_policies`, `pg_get_functiondef('public.has_capability(text)'::regprocedure)` e `public.role_capabilities`):

- `simulados`: policy `Anyone can read published simulados` permite `status='published'`; `Admins can read all simulados` exige `has_capability('content.manage')`. Portanto uma tentativa sintetica nao torna test visivel ao PRO comum.
- `questions`: `fase0_questions_release` permite capability de conteudo ou EXISTS de simulado published/test com inicio atingido. Esse EXISTS esta sujeito a RLS de simulados no caller comum: o teste consulta de fato simulados e questoes como authenticated, nao apenas examina o texto da policy.
- F1 `simulados_archived_owner` permite archived quando existe tentativa do proprio auth.uid(); `simulados_archived_fence` restringe archived a esse owner ou content.manage. Fonte: `20261104065001_fase1_edition_model.sql`, linhas 285-295. A policy de questoes F0 nao foi ampliada por F1. Por isso o helper preserva somente a leitura do caderno historico archived ja liberado/finalizado; nao abre leitura direta de questoes ou explicacoes arquivadas.
- `has_capability(text)` consulta user_roles JOIN role_capabilities com auth.uid(), nao claims de segmento. O catalogo confirmou `content.manage` para os roles existentes admin e content_editor. O positivo usa uma atribuicao temporaria real de content_editor, integralmente revertida junto com as fixtures.

TDD desta revisao, com o mesmo comando psql de teste e o mesmo clone:

1. RED contra o helper anterior: `RED: normal PRO must not read test notebook` (erro de script, exit 3). Antes da falha, as consultas reais RLS confirmaram que o PRO nao via o simulado test nem a questao.
2. Depois de adicionar apenas o guard content.manage para test, segundo RED: `RED: archiving must preserve cumulative notebook page` (exit 3). Os negativos test/draft e os positivos com content_editor ja tinham passado.
3. Depois de incluir archived no ramo historico, aplicacao com a guarda host/port/db/session_user e fixture completa: GREEN (exit 0), incluindo reaplicacao da migration e igualdade integral das linhas armazenadas.

Regressoes adicionais preservam a fixture base de 1500 linhas / pagina 50 / 30 paginas sem duplicatas. As transicoes usam savepoints e revertem todo status, perfil, role e timestamp antes da proxima etapa:

- Published -> test sem capability: total cumulativo 800, filtro A 0, manuais 100 preservados, lista e contagens concordam. Com content_editor PRO: total 1500 e filtro A 700; perder PRO continua negando acesso. Release futura exclui as 700 mesmo com capability.
- Published -> draft: PRO comum nao ve o simulado e caderno fica em 800 / filtro A 0. Draft tambem e excluido com content_editor.
- Published -> archived, owner com tentativa submitted/finalizada e release passada: igualdade exata do JSON de pagina cumulativa, contagens cumulativas, pagina da edicao A e contagens da edicao A antes/depois; continuam 1500 / 700 e o mesmo item/metadata. A consulta direta confirma simulado archived visivel ao owner e questao ainda oculta pelo F0. Release futura volta a excluir as 700.

Pendente para integracao: execucao SQL independente pelo revisor/Codex, conforme solicitado pelo orquestrador. Esta execucao nao delegou trabalho nem declara essa revisao independente concluida.
