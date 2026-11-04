# Reprocessamento Auditado (F2-5)

## Contrato

`public.admin_reprocess_simulado(p_simulado_id uuid, p_reason text) returns jsonb`.

O operador corrige a coluna Gabarito em outro fluxo e, depois, solicita o
reprocessamento. A RPC nao altera questoes/alternativas, nao chama finalizadores,
nao reabre tentativas e nao trata o backlog legado. A descricao antiga do
incidente S6 sobre o importador nao e a causa atual: o problema e Gabarito, nao
o parser de comentario. A migration historica foi apenas lida, nunca executada.

- Exige `auth.uid()` e simultaneamente `content.manage` e `attempts.manage`.
- Nenhuma role/capability nova. EXECUTE apenas para authenticated; PUBLIC, anon e
  service_role sem grant da RPC. Um service token sem identidade nao e operador.
- Motivo nao vazio, com limite de 2000 caracteres; isolamento READ COMMITTED.
- Janela de execucao encerrada; todos os attempts da prova submitted/expired,
  com finished_at, nota, snapshot F1 capturado, AQR e historico completos.
- Confere questions_count contra a contagem real, numeracao unica/contigua,
  formato de alternativas da edicao, labels/textos e exatamente uma correta.
- Confere pertencimento de cada AQR a prova, alternativa selecionada a questao,
  quantidade de resultados, total_answered e identidade/vinculo do historico.
- Inconsistencia recusa a operacao inteira antes dos writes, inclusive tentativa
  in_progress/vencida presa. Nao reparar automaticamente dados historicos.

Retorno sem dados individuais de alunos:

```json
{
  "operation_id": "uuid",
  "simulado_id": "uuid",
  "answer_key_hash": "sha256",
  "attempts_processed": 6,
  "scores_changed": 6,
  "entries_reconciled": 4,
  "summaries_changed": 2,
  "idempotent": false
}
```

## Calculo E Preservacao

Ordem transacional: AQR -> totais/nota de attempts -> historico ->
`recalculate_user_performance` de todos os usuarios afetados -> caderno.
Ranking continua sendo consulta/view sobre os dados atualizados, sem cache novo.

O helper autoritativo tambem repara resumo ausente ou incorreto quando AQR,
attempt e historico ja estao corretos. `summaries_changed` conta resumos realmente
alterados e participa de `idempotent`, das contagens privadas e da auditoria.
O calculo nao e copiado para a RPC: a migration acrescenta somente um predicado
de diferenca semantica ao upsert do helper existente. Formula, assinatura void,
owner, ACL, SECURITY DEFINER e search_path permanecem iguais. Uma cauda de upsert
desconhecida recusa a migration para inspecao, em vez de sobrescrever outra formula.
Assim, chamadas existentes do finalizador F0 tambem preservam updated_at em no-op.

A nota e exclusivamente percentual bruto: `round(acertos * 100 / questoes_reais,2)`.
Nao e TRI, mesmo quando o formato historico da edicao usa esse nome. Questao
em branco e erro e `was_answered=false`; total_answered da tentativa e validado
e preservado, nao passa a contar questoes em branco.

Nao se alteram status, modalidade, is_within_window, finished_at, deadline,
timestamps de tentativa, edition_id, specialty_id_at_finish,
target_institution_ids_at_finish ou snapshot_backfilled. Os triggers F0 e F1
continuam ativos, sem reset/bypass de snapshot. UPDATEs de resultados, historico
e caderno so ocorrem quando os respectivos dados mudam; o resumo nao ganha novo
updated_at em uma repeticao sem mudancas. Cada chamada bem-sucedida, incluindo
repeticao, ainda produz sua propria operacao auditada.

## Caderno

Reconciliam-se somente entradas existentes ligadas a prova, questao e usuario
afetados por mudanca de AQR nesta operacao. Nao se criam entradas, nem se alteram
reflexoes, revisoes/SRS, aprendizado, resolucao, chats ou question_user_notes.
Como error_notebook nao possui attempt_id, usa-se a tentativa finalizada mais
recente do usuario na prova, com desempate por id DESC. Essa escolha explicita
evita o resultado arbitrario de um JOIN entre varias modalidades.

A coluna nullable `reprocess_deleted_at` distingue exclusao automatica de manual.
Dados antigos recebem NULL, sem adotar exclusoes antigas como automaticas.

- Erro que virou acerto: atualiza was_correct e, se ativo, soft-delete com
  deleted_at e reprocess_deleted_at iguais.
- Acerto que voltou a erro: restaura apenas exclusao marcada pelo reprocessamento.
- Exclusao manual: preserva deleted_at e origem manual, mas atualiza was_correct
  se necessario; nunca ressuscita a entrada.
- Exclusao voluntaria posterior a uma exclusao automatica: mudar deleted_at sem
  mudar o marcador limpa a origem automatica por trigger.
- Clientes nao podem forjar o marcador. Metadado automatico exige timestamp igual
  a deleted_at. No rollback, manter coluna e guard para preservar a proveniencia.

## Locks E Auditoria

Locks de linha, nunca LOCK TABLE attempts: usuarios afetados (auth.users), todas
as suas tentativas em ordem de id, simulado alvo, questoes/alternativas, edicao,
resultados, historico/resumo e entradas existentes do caderno. Travar tentativas
do mesmo usuario em outras provas e intencional: o resumo e cumulativo e seu
finalizador nao pode calcular um agregado com historico desatualizado. Usuarios
nao afetados em outras provas permanecem independentes.

O finalizador existente trava tentativa antes de pedir SHARE no simulado. Escrita
de alternativa pode possuir a alternativa antes de pedir SHARE no simulado.
Para nao formar ciclo com esses caminhos existentes, a RPC adquire seus locks
com NOWAIT. Contencao retorna `55P03`, sem writes da operacao: aguardar a outra
transacao concluir e solicitar novamente, sem loop automatico irrestrito.
READ COMMITTED permite revalidar o conjunto de usuarios apos adquirir o pai;
o FK de auth.users e o lock do simulado cercam novas tentativas.

`fase2_private.reprocess_operations` guarda UUID, operador, motivo, SHA-256
ordenado de questao/alternativa correta, contagens antes/depois e checkpoint
privado. O checkpoint inclui apenas attempts/AQR/historico da prova e entradas
associadas, mais os resumos cumulativos dos usuarios afetados. Schema sem USAGE
para clientes, tabela com RLS e sem grants a PUBLIC/anon/authenticated/service_role.
`admin_audit_log` recebe a referencia da operacao, motivo, hash e contagens, nao
o checkpoint de alunos. Erro de calculo ou auditoria aborta todos os writes.

`fase2_private.reprocess_ddl_checkpoint` guarda a primeira definicao real do
helper antes do patch, sem substitui-la nas reaplicacoes. Tem RLS e a mesma
restricao de acesso privado; permite rollback exato do DDL sem copiar a formula.

## Ensaio Local

Nenhuma aplicacao em producao, rede externa, arquivo .env, pacote instalado,
git mutante ou subagente. Apenas PostgreSQL em `127.0.0.1:54737`, usuario postgres.
Antes de mutacoes, conferir host, porta, current_database e session_user.
Nao executar os testes contra outro alvo: eles recusam nomes fora de
`enamed_test_reprocess_*` e usam ON_ERROR_STOP, statement_timeout e lock_timeout.

Definicoes reais inspecionadas no template
`enamed_test_f1_admin_review_20261104`: finalizador F0, guards F0/F1, modelo,
targets, capabilities/auditoria/admin, ranking, recalculate_user_performance e
lock_option_simulado. O template nao tinha admin_import_questions; seu SQL F1
foi inspecionado no repositorio (parent FOR UPDATE e snapshots READ COMMITTED).
O importador opcional nao foi aplicado ou executado neste ensaio.

Clones exclusivos usados:

- `enamed_test_reprocess_3aaa`: migration aplicada e regressao SQL transacional;
  fixtures revertidas por ROLLBACK.
- `enamed_test_reprocess_3aaa_concurrency`: primeiro ensaio concluido, retido.
- `enamed_test_reprocess_3aaa_concurrency_v2`: ensaio anterior ampliado, retido.
- `enamed_test_reprocess_3aaa_concurrency_v3`: ensaio final com reparo de resumo,
  no-op F0 e rollback do helper, com dados
  sinteticos e checkpoints retidos para revisao; nao reutilizar para fixtures.

Comandos a partir da raiz deste worktree, usando o psql local indicado na tarefa:

```powershell
$psql = "..\..\fase0-2027\.superpowers\editions\pg17-1260616\pgsql\bin\psql.exe"
& $psql -X -w -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_reprocess_3aaa -v ON_ERROR_STOP=1 -f supabase/tests/fase2_reprocess.sql
node --test scripts/sql-local/reprocess-concurrency.test.mjs
# Somente em OUTRO clone novo, preparado com a migration e sem fixtures f25:
node scripts/sql-local/reprocess-concurrency.mjs enamed_test_reprocess_NOVO_CLONE
```

Resultados verificados em 04/11/2026:

| Verificacao | Resultado |
| --- | --- |
| TDD inicial, RPC ausente | Falhou com F2-5 RPC missing, como esperado |
| TDD de resumo isolado | Falhou com Isolated wrong summary must be repaired and reported antes da correcao |
| Regressao SQL final | Exit 0; 49 ASSERT declarados, recusas esperadas e fixtures revertidas |
| Guard do harness Node | 2 testes passando, 0 falhando |
| Duas sessoes psql, versao final | 15 asserts passando; duas barreiras reais observadas |
| Rollback DDL e duas reaplicacoes com dados | Digests de attempts/AQR/historico/resumo/caderno/audit/checkpoints inalterados |
| Helper no rollback/reaplicacao | Definicao original restaurada exatamente; owner/ACL/assinatura/config preservados |

Regressao: 2 usuarios, 3 modalidades, 2 provas, notas subindo/caindo na mesma
chamada, AQR/historico/resumo/ranking, questoes em branco, snapshots com IDs nao
nulos, caderno afetado/nao afetado, exclusao manual antes/depois da exclusao
automatica, repeticao idempotente e reversao B -> A. Negativos: aluno/editor/
suporte sem dupla capability, auth.uid ausente, motivo vazio, prova aberta,
tentativa in_progress, contagem divergente, AQR faltante/estrangeiro, alternativa
de outra questao, alternativas incompletas, zero/duas corretas. Falhas injetadas
no historico e audit verificam rollback inclusive do checkpoint. Drift isolado
de resumo incorreto/ausente e reparado, sem alterar o restante da cadeia nem o
resumo correto do outro usuario. Falha de audit apos cada reparo reverte tudo,
inclusive resumo recem-inserido. Repeticao preserva timestamps antigos em no-op.
Snapshot
imutavel e ACLs sao verificados sem desativar guards.

Concorrencia: locks confirmados por pg_stat_activity, pg_blocking_pids e pg_locks,
nao por sleep. Reprocessamento bloqueia correcao/finalizacao; no sentido inverso
recusa com 55P03. O teste chama o finalizador F0 real de tentativa in_progress
de OUTRA prova do mesmo usuario, verifica escrita de resultados em branco e
resumo consistente. Uma segunda execucao real do calculo F0 com entradas iguais
preserva o resumo inteiro, inclusive updated_at antigo. Outra prova/usuario cria tentativa enquanto a transacao de
reprocessamento esta aberta. Limites: 6s statement, 5s lock, 4s para observar
barreira, 10s por comando no cliente; toda falha termina com exit nao zero.

## Rollback E Revisao

Rollback operacional comentado no fim da migration: remover a RPC e restaurar
a definicao original do helper a partir do checkpoint DDL privado; preservar
checkpoints, dados e marcador/trigger do caderno. Reaplicar restaura a RPC e o
upsert condicional sem tocar dados dos alunos. Nao fazer restauracao cega dos checkpoints:
uma nova correcao de gabarito deve gerar outra operacao identificada.

Revisao/deploy permanecem com o orquestrador. Suite global/build nao executados,
por escopo. Nao houve teste de carga com volume de producao; o checkpoint JSON
fica em memoria da transacao e o custo cresce com o simulado e usuarios afetados.
Revisar tamanho/retencao e politicas operacionais antes de qualquer aplicacao
em producao. O teste de concorrencia e deliberadamente descartavel e de uso
unico por clone; nao apaga dados para permitir nova execucao.
