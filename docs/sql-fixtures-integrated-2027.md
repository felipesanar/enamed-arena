# Fixtures F0-F2 no schema integrado

Job: `fixtures-integrated-0cb2`, executado localmente em 2026-11-04.
Somente QA. Nenhuma migration, RPC, policy, trigger produtivo, Edge Function,
arquivo de source, pacote ou arquivo de segredo foi editado.

## Ambiente e isolamento

- Endpoint fixo: `127.0.0.1:54737`, `session_user=current_user=postgres`.
- Binario relativo ao worktree: `../../fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe`.
- Template integrado fornecido pelo parent: `enamed_test_integrated_20261104_0920`.
- Clone inicial de reproducao: `enamed_test_fixtures_integrated_20261104_0cb2`.
- Clone novo da rodada final: `enamed_test_fixtures_integrated_20261104_final0cb2`.
- Comparacao F0: clone `enamed_test_fixtures_integrated_f0_20261104_0cb2`, criado a partir de `enamed_test_sqlqa_20261104075418503_34180_catalog`.
- Nenhuma fixture foi executada nos templates. Nenhum banco foi removido.
- Runner usa `-X -w`, `ON_ERROR_STOP=1`, `plpgsql.check_asserts=on`, `sql_local=1` (assertions locais existentes, sem instalar pgTAP), timeout de 180 segundos por processo e logs locais privados.

Antes de DDL/DML o runner valida a conexao real por SQL. O helper tambem valida
host, porta, prefixo `enamed_test_`, session/current user e ausencia de JWT antes
de criar seus objetos temporarios. Os callbacks repetem essa verificacao.
O runner aceita somente clones com prefixo `enamed_test_fixtures_integrated_` e
nomes de fixtures F0-F2 sem caminhos arbitrarios.

## Reproducao e ajustes

RED inicial: `fase0_safe_finalization.sql` falhou em `unauthorized`, dentro de
`enforce_admin_publication()` ao inserir o simulado. O mesmo ocorreu em
`fase1_performance_scope.sql`. Nenhuma assercao de negocio havia sido alcancada.
Outros erros iniciais e intermediarios estao preservados nos logs de reproducao
do primeiro clone em `.superpowers/fixturesQA/`.

O helper `supabase/tests/local/fixture-publication-setup.sql` e incluido dentro
de `BEGIN`/`ROLLBACK`. Ele captura o modo anterior de `trg_admin_publication`,
recusa estado desabilitado ou chamada aninhada e suspende **somente esse trigger**
enquanto postgres cria simulados sinteticos. Restaura exatamente `O`, `R` ou `A`
e confere `tgenabled` antes de qualquer identidade JWT ou acao verificada.
Em F0, ausencia desse trigger e um no-op valido. Nenhum callback e SECURITY
DEFINER; `SET ROLE authenticated` com `session_user=postgres` nao o autoriza.
Estado salvo e objetos auxiliares sao temporarios e descartados no rollback.

Nao foram desligados RLS, score guard, finalizadores ou integridade de respostas
para corrigir falhas. Suspensoes preexistentes para dados historicos sinteticos
foram mantidas, incluindo sua restauracao antes dos respectivos callers.

| Fixture/tema | Antes | Ajuste QA e contrato preservado |
| --- | --- | --- |
| safe_finalization, performance_scope, attempt_reliability, archived_result_read, user_edition_targets, analytics_scope, notebook_pages | Simulados published sem conteudo eram inseridos antes de existir guard de publicacao | Suspensao restrita apenas ao INSERT sintetico, restaurada antes de claims/roles; demais asserts mantidas |
| edition_model | Mesmo setup legado e INSERT de duplicata com status published implicito | Helper apenas nos INSERTs iniciais; teste de unicidade usa draft, sem suspender guard durante a assercao |
| question_release | Fixture NULL start tambem tinha end posterior ao release, hoje rejeitado pelo CHECK F1 | Mantido NULL start e a respectiva negativa; end agora precede release |
| exam_integrity | Release movido para now com janela ainda aberta | Move end tambem para now; release continua exatamente na fronteira testada; todas as 75 assertions locais passam |
| admin_audit | CRUD de um simulado vazio usava published por default | Objeto de CRUD e draft; as nove operacoes auditadas, identidade, diff e falha atomica continuam verificadas com guard ativo |
| question_import | Edicao declarava 120 questoes, mas publicava somente uma | Formato e questions_count coerentes com uma questao na publicacao real; negativa de import exige erro de simulado/status (nao basta erro de numero fora do formato). Formato 120 restaurado para o teste seguinte de erro atomico. Nenhum helper/bypass nessa fixture |
| reprocess | Status test sintetico nao representa o caminho publicado atualmente reprocessavel | published sintetico sob helper; claim do admin movida para depois do setup; reprocessamento real, ownership, score e idempotencia mantidos |
| Guards de nomes de DB | Algunas fixtures exigiam prefixos exclusivos de outros jobs | Adicionado somente o prefixo restrito deste clone; host/porta/usuario permanecem exigidos |

## Contratos atualizados

### Historico D6

Expectativa antiga de `notebook_pages`: arquivado nunca aparecia em browsing de
questoes, nem para dono finalizado com resultado liberado. A migration D6 e a
fixture `fase1_archived_result_read.sql`, ja instaladas no template integrado,
preservam historico de dono submitted/expired apos release. A alteracao foi
expressamente autorizada pelo parent durante este job.

O teste agora exige questao **e explicacao** para o dono finalizado. Adiciona
negativas de outra conta e de dono inacabado, para questao e explicacao, e reforca
ambas as negativas quando release e futuro. Mantem igualdade integral de pagina
e counts antes/depois de arquivar, filtros por edicao, PRO gate, test/draft,
liberacao e ausencia de vazamento de correcoes. O teste dedicado de historico
arquivado tambem passa, incluindo seus estados submitted/expired.

### Edicoes F0 versus F1

F0 permitia DML direto de edicoes para content.manage e negava UPDATE/DELETE
sem capacidade por RLS (zero linhas). F1 admin editions revoga DML direto e exige
`admin_upsert_edition(jsonb)` mesmo para callers capazes. O catalogo instalado
confirmou essa assinatura e o teste original falhava em permission denied.

`fase0_exam_editions.sql` continua executando o caminho original na base F0.
Quando a RPC F1 existe, exige que INSERT/UPDATE/DELETE diretos de um caller capaz
sejam negados e verifica INSERT/UPDATE/arquivamento atraves da RPC. A negativa
sem capacidade aceita tanto zero linhas por RLS quanto insufficient_privilege,
sem admitir escrita. As duas variantes foram executadas em clones separados.
Revisao do Codex solicitada especificamente para esta adaptacao de contrato e
para a atualizacao D6; nao ha mudanca de produto neste diff.

## Evidencias da rodada final

Resumo privado exato, incluindo caminho de cada log, exit code, mensagens PASS
e blocos DO concluidos:

`.superpowers/fixturesQA/enamed_test_fixtures_integrated_20261104_final0cb2-summary-1793810405006.json`

Rechecagem apos reforcar a negativa de importacao para exigir o campo de erro
`simulado`: question_import e notebook_pages novamente PASS, exit 0, em
`.superpowers/fixturesQA/enamed_test_fixtures_integrated_20261104_final0cb2-summary-1793810497385.json`.

Blocos DO incluem setup e nao equivalem a quantidade de assertions. Assertions
SQL interrompem a fixture em qualquer falha com ON_ERROR_STOP. Quantidades de
mensagens PASS abaixo sao apenas onde os testes existentes as emitem.

| Fixture | Resultado | Exit | DO concluidos | Evidencia adicional |
| --- | --- | --- | --- | --- |
| local/fixture_publication_guards.sql | PASS | 0 | 5 | Recusa anon, authenticated mesmo sem auth.uid, claims anon e ator; restaura O/R/A; recusa D e nesting; falha de setup restaura DDL; publicacao real sem caller falha em P0003; ausencia do trigger F0 aceita |
| fase0_safe_finalization.sql | PASS | 0 | 2 | Finalizacao, nota e release originais |
| fase0_preserve_history.sql | PASS | 0 | 2 | Sem alteracao neste job |
| fase0_question_release.sql | PASS | 0 | 8 | Owner, janela, NULL start e draft |
| fase0_exam_integrity.sql | PASS | 0 | 1 | 75 mensagens PASS de assertions locais |
| fase0_exam_editions.sql | PASS | 0 | 4 | Contrato F1 RPC/ACL |
| fase0_admin_audit.sql | PASS | 0 | 5 | passing_assertions=93; negativa audit.view e positiva admin |
| fase1_admin_editions.sql | PASS | 0 | 4 | Sem alteracao; publicacao real com guard ativo |
| fase1_attempt_reliability.sql | PASS | 0 | 2 | 22 mensagens PASS |
| fase1_archived_result_read.sql | PASS | 0 | 20 | Dono finalizado, outros, inacabados e release |
| fase1_cutoff_reference.sql | PASS | 0 | 4 | 47 mensagens PASS; apenas guard de DB alterado |
| fase1_edition_model.sql | PASS | 0 | 2 | 21 mensagens PASS |
| fase1_question_import.sql | PASS | 0 | 8 | 22 mensagens PASS; guard de publicacao nunca suspenso |
| fase1_server_clock.sql | PASS | 0 | 2 | Sem alteracao neste job |
| fase1_user_edition_targets.sql | PASS | 0 | 9 | Asserts de seguranca e onboarding mantidas |
| fase1_performance_scope.sql | PASS | 0 | 5 | Scope, pagina, ranking e negativas mantidos |
| fase2_analytics_scope.sql | PASS | 0 | 15 | PASS final original |
| fase2_admin_period.sql | PASS | 0 | 8 | Default after-installed; PASS final original |
| fase2_reprocess.sql | PASS | 0 | 15 | Scores, idempotencia e dados privados originais |
| fase2_notebook_pages.sql | PASS | 0 | 26 | D6 positivo e negativos, pagina e counts |

Total aplicavel integrado: **19 fixtures PASS, zero FAIL**, mais o teste SQL do
helper PASS. Isso nao inclui os dois drivers e modos opcionais abaixo.

Comparacao das seis fixtures F0: **6 PASS, zero FAIL**, todos exit 0, com resumo
em `.superpowers/fixturesQA/enamed_test_fixtures_integrated_f0_20261104_0cb2-summary-1793810418539.json`.
Confirma a compatibilidade do helper sem trigger F1 e o caminho legado de DML de
edicoes, sem silenciar as assertions originais.

`node --test scripts/sql-local/fixtures-integrated.test.mjs`: **2 PASS, zero FAIL**.
TDD do runner comecou com falha por modulo inexistente. As fixtures afetadas
foram executadas vermelhas antes dos ajustes; logs antigos foram preservados.
Um comando intermediario incluiu por engano `fase0_performance_scope.sql`
(inexistente, exit 1); o arquivo correto F1 foi executado nas rodadas finais.

Consulta pos-rodada confirmou no clone final: users=0, simulados=0, attempts=0,
publication_mode=O, host=127.0.0.1, port=54737, session/current user=postgres.
As execucoes com erro em clones anteriores encerraram conexao e descartaram a
transacao, sem cleanup destrutivo. Nenhum backlog de alunos foi finalizado.

## Nao executados

| Fixture/modo | Resultado | Motivo |
| --- | --- | --- |
| fase0_integration_jobs.sql | SKIP | Driver exige banco completamente vazio sem profiles/net/vault/cron e cria mocks desses servicos; nao e fixture after-installed compativel com este template. Nao foi executado nem alterado |
| fase1_edition_backfill.sql | SKIP | Driver exige pre-F1 vazio e aplica migration real; schema integrado ja possui o modelo. Nao se removeu schema nem se forcou skip_migration |
| fault=1 / lifecycle=1 de admin_period | SKIP | Rodada deste job e default after-installed. Nenhuma injecao/reaplicacao/rollback de migration foi forcada no template integrado; exige clones com o checkpoint adequado |

Nao instalar extensoes ou executar cron para transformar esses SKIPs em PASS.
Validacao dos drivers/modes de lifecycle fica com o orquestrador em seus clones
apropriados; nao declarar cobertura integral de migrations a partir desta matriz.

## Reexecutar

Criar um clone com nome novo (o runner nunca sobrescreve nem remove banco):

```powershell
node scripts/sql-local/fixtures-integrated.mjs enamed_test_fixtures_integrated_novosuffix --clone
```

O suffix deve estar em minusculas. Exemplo executavel de testes do escopo:

```powershell
node --test scripts/sql-local/fixtures-integrated.test.mjs
node scripts/sql-local/fixtures-integrated.mjs enamed_test_fixtures_integrated_20261104_final0cb2 --guards fase0_safe_finalization.sql fase0_preserve_history.sql fase0_question_release.sql fase0_exam_integrity.sql fase0_exam_editions.sql fase0_admin_audit.sql fase1_admin_editions.sql fase1_attempt_reliability.sql fase1_archived_result_read.sql fase1_cutoff_reference.sql fase1_edition_model.sql fase1_question_import.sql fase1_server_clock.sql fase1_user_edition_targets.sql fase1_performance_scope.sql fase2_analytics_scope.sql fase2_admin_period.sql fase2_reprocess.sql fase2_notebook_pages.sql
```

Nao ha flags de fault/lifecycle implicitas. Cada fixture roda em uma conexao
separada, dentro das suas transacoes descartaveis; erro nao e retentado nem
reclassificado como sucesso. Logs e summaries tem nomes unicos por execucao.

## Revisao independente do Codex

Diff revisado, incluindo a substituicao do DML de edicoes pelo RPC F1 e as
negativas D6 preservadas. Em outro clone novo, `enamed_test_fixtures_integrated_review1342`,
o runner final com assertions explicitamente ativas passou novamente nas 19
fixtures e no helper SQL; os dois testes Node tambem passaram. Os hashes SHA256
dos 20 arquivos SQL/mjs permaneceram iguais antes e depois dos checks e apos o
encerramento do job. Resumo privado: `.superpowers/fixturesQA/enamed_test_fixtures_integrated_review1342-summary-1793810521097.json`.
