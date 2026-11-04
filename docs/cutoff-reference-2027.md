# Cortes Por Referencia: Backend Preparado

## Estado E Limites

F1-5 SQL preparado e validado somente no PostgreSQL portatil local. **D6 continua sem fonte confirmada.** A atribuicao real de fonte/processo depende de decisao externa de Conteudo/Produto; isto nao e entrega completa dos dados de cortes. Nenhum backfill, deduplicacao, consulta externa, commit, deploy ou acesso a producao foi realizado.

O contrato aprovado em `docs/contracts/cutoff-reference-2027.md` prevalece sobre a sugestao de backfill no HANDOFF. Nao se atribuiu o legado ao Enare nem a qualquer edicao presumida. As linhas historicas permanecem com `reference_edition_id` e `source` nulos, inclusive duplicatas e IDs historicos ausentes.

## Migration

Arquivo: `supabase/migrations/20261104090759_fase1_cutoff_reference.sql` (timestamp UTC da criacao). O arquivo agora e **um unico statement `DO`**, cujo `EXECUTE` executa os DDLs, revokes e definicoes. A atomicidade e intrinseca ao statement, inclusive com `psql -f` sem `-1`: qualquer erro desfaz todo o arquivo. Nao ha `BEGIN/COMMIT` de transacao dentro dele; o reapply participa da transacao do caller e nao confirma seeds da fixture. O `BEGIN` do bloco PL/pgSQL nao inicia nem confirma transacao.

- Ambas as tabelas recebem FK nullable para `exam_editions`, com `ON DELETE RESTRICT`, e `source text` nullable. Nenhuma linha antiga e atualizada.
- Unique parcial de cortes: `(institution_id, specialty_id, practice_scenario, reference_edition_id)` somente com referencia conhecida. Programas usam `lower(btrim(coalesce(cenario_pratica,'')))` exclusivamente na chave: o texto recebido e preservado. Nao se normaliza o texto dos cortes.
- Constraint `NOT VALID` protege linhas referenciadas sem validar ou adulterar historico. Trigger de INSERT exige referencia, IDs canonicos nao nulos e fonte nao vazia em **novos** registros de ambas as tabelas; FKs validam existencia. Novas linhas nao podem se disfarcar de legado. Atualizacao programatica de dados existentes nao foi exposta.
- Escritas diretas de `PUBLIC`, `anon` e `authenticated` sao revogadas; o importador e o unico escritor cliente. RLS e politicas de leitura preexistentes nao sao removidas. `service_role` continua reservado ao backend confiavel.
- Notices reportam contagem de legado, IDs nulos e grupos de chaves duplicadas; nao escolhem sobreviventes. Referencias conhecidas conflitantes fazem a criacao do indice falhar, nao geram limpeza automatica.

## Leitura E Compatibilidade

Assinaturas publicas, sem overload antigo ambiguo:

```sql
get_cutoff_scores(p_specialty_id uuid, p_institution_ids uuid[],
                  p_reference_edition_id uuid default null)
get_user_cutoff_context(p_user_id uuid default auth.uid(),
                        p_reference_edition_id uuid default null)
```

As seis colunas anteriores de `get_cutoff_scores` mantem ordem/tipos; as novas sao `reference_edition_id`, `reference_label`, `source`. Referencia explicita e soberana: todos os cenarios dessa referencia, sem agregar outras edicoes. Label vem de `exam_editions.cutoff_reference_label`, nunca de um ano inferido; fonte vem da linha importada. Uma referencia explicita inexistente retorna vazio.

Com referencia omitida e `editions_ui=false` (tambem flag ausente), `get_cutoff_scores` preserva `DISTINCT ON`/maior corte antigo por instituicao, **apenas sobre linhas de referencia nula**. Novos processos jamais alteram esse maior corte. O contexto preserva os motivos e JSON legados, inclusive a regra antiga de match textual e estatisticas, usando uma copia privada da definicao original filtrada por referencia nula. A rota legada nao muda silenciosamente para IDs, pois isso mudaria seu resultado historico.

Com `editions_ui=true`, a ordenacao explicita e: `preparing` antes de `active`, depois menor `year`, menor `term`. Nao usa relogio, data oficial presumida, `planned` ou referencia de outra edicao. Empate no mesmo estado/ano/termo e recusado, mesmo que IDs sejam distintos. Edicao sem label de referencia conhecido retorna vazio; label conhecido sem dados tambem retorna vazio, sem reutilizar legado. Esta e uma convencao deterministica de catalogo, nao confirmacao de calendario ou da fonte D6.

`get_user_cutoff_context` usa `specialty_id` e `target_institution_ids` canonicos quando presentes na nova rota; nomes so sao fallback se o respectivo ID/conjunto nao estiver preenchido. Nao troca IDs sem match por strings parecidas. Mantem `has_target_cutoff`, `reason`, `specialty`, `target_institutions`, `matches`, `unmatched_institutions`, `stats`; acrescenta contexto de referencia e, em cada match, referencia/label/fonte. Ausencia de onboarding e onboarding incompleto mantem seus motivos; identidade ausente ou caller diferente retorna `unauthorized` sem dados.

Metadata `reference_reason`: `legacy_unknown_source`, `explicit`, `catalog_current`, `unknown_reference`, `no_current_edition`, `ambiguous_current_edition`. `reason=no_match` explica uma referencia conhecida sem matches. `mode` diferencia `legacy`, `reference`, `empty`. Para `get_cutoff_scores`, a assinatura tabular contratada nao comporta um envelope de erro: contexto explicativo esta na RPC de contexto.

Readers sao `SECURITY DEFINER` com `search_path=pg_catalog,public`, identidade obrigatoria e contexto restrito ao proprio usuario. Cortes/catalogos ja sao dados de leitura autenticada; nao se expoe onboarding de terceiros. ACL de execucao somente `authenticated`/`service_role`, nunca `PUBLIC`/`anon`; mesmo uma chamada autenticada sem `auth.uid()` nao retorna dados.

## Importacao

```sql
admin_import_cutoffs(p_reference_edition_id uuid, p_source text, p_rows jsonb)
-- {ok: boolean, imported: integer,
--  errors: [{row: integer, field: text, message: text}]}
```

Exige identidade e `admin_require('content.manage')` real. `content_editor` com essa capability pode importar; aluno nao. Cada linha recebe IDs existentes, cenario text (vazio permitido pelo schema legado), corte geral numerico finito, cota numerica finita ou null e vagas inteiras nao negativas opcionais (ausentes/null = 0). Fonte nao vazia e edicao existente sao obrigatorias. A fonte e declarada pelo administrador: o SQL nao autentica sua veracidade nem procura dados na internet.

Linhas sao numeradas a partir de 1; erros de envelope usam `row=0`. Validacao coleta erros por linha/campo antes de escrever. Duplicatas do request, do banco ou chaves normalizadas conflitantes dos programas rejeitam o lote inteiro. Nao ha upsert, troca silenciosa de referencia, substituicao de fonte ou alteracao de gabaritos. Cada linha cria um corte e um programa, preservando cenario/fonte originais. Se vagas nao forem conhecidas, 0 e apenas o default ja existente de programas, nao afirmacao de oferta oficial.

Lock transacional por referencia serializa importacoes concorrentes pela RPC; indices/FKs continuam protegendo escritas de outros caminhos. Todos os inserts e `admin_log_action` estao na mesma subtransacao: falha no meio, FK, indice ou auditoria retorna `ok=false, imported=0` e desfaz ambos os conjuntos de inserts. Auditoria registra identidade, referencia, fonte, `before=[]` e linhas `after`; falha de auditoria nao e ignorada. Erros de escrita retornam linha/campo `insert` e SQLSTATE sem expor dados internos.

## Preservacao E Rollback

Antes de retirar as assinaturas antigas, a migration faz preflight de dependencias catalogadas em `pg_depend` e usa somente `DROP ... RESTRICT`. Dependencias descobertas bloqueiam a expansao para revisao; nao ha `CASCADE`. Dependencias dinamicas ou consumidores externos precisam de revisao pelo orquestrador, pois nao aparecem necessariamente no catalogo.

`cutoff_private.original_functions` guarda definicoes originais, dono e ACL uma unica vez. Tabela tem RLS habilitada e nenhum grant cliente; schema, view legada e todos os helpers sao privados, inclusive para `service_role`. Reapply nao substitui o snapshot nem a copia legada. Os consumidores publicos continuam com as ACLs explicitas acima.

Rollback nao destrutivo esta comentado ao final da migration: desligar flag e interromper imports; inspecionar dependencias das novas assinaturas; manter wrappers ou restaurar originais com filtro **obrigatorio** `reference_edition_id IS NULL`, preservando owner/ACL do snapshot. Nao executar a definicao original sem filtro apos importar processos novos, pois isso contaminaria o maior corte legado. Nao remover colunas, indices, linhas referenciadas ou snapshots. Nao existe rollback destrutivo automatico. Restauracao de grants deve considerar entradas `PUBLIC` e nao usar defaults implicitos.

## Validacao Local

Servidor verificado antes de mutacoes: `127.0.0.1:54737`, `session_user=postgres`. Clone descartavel `enamed_test_cutoff_20261104_61e4`, criado de `enamed_test_f1_target_review_20261104`. O teste recusa outro host/porta/usuario e bancos fora de `enamed_test_cutoff_%`.

Executavel usado: `C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe`.

Comandos principais (apos verificacao bloqueante de conexao, sem credenciais em argumentos):

```powershell
& $psql -X -w -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_cutoff_20261104_61e4 -v ON_ERROR_STOP=1 -f supabase/migrations/20261104090759_fase1_cutoff_reference.sql
& $psql -X -w -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_cutoff_20261104_61e4 -v ON_ERROR_STOP=1 -f supabase/tests/fase1_cutoff_reference.sql
```

TDD: primeiro teste falhou por ausencia da RPC (exit 3); apos expansao passou. A assercao adicional que impede novo registro sem fonte tambem foi vista falhar antes do trigger e passar apos implementacao. A fixture cria dois processos, dois cenarios na mesma instituicao/especialidade, duplicatas legadas, programa legado e usuarios locais; exercita isolamento, flags, canonical IDs, ACL, capability, auditoria, validacao, rollback e reapply. Todos os objetos e dados sinteticos ficam dentro de `BEGIN/ROLLBACK`. Triggers de provisionamento/integracao de `auth.users` sao desabilitados apenas transacionalmente no setup local para evitar emails/requisicoes; dados historicos sinteticos sao inseridos com triggers suspensos apenas nesse trecho da fixture. A RPC e avaliada com role `authenticated` e JWT sub local; nao substitui a autorizacao por mock.

O template local nao contem os 1.058 cortes de producao mencionados no HANDOFF. A preservacao do legado e provada por fixtures, **nao** por reconciliacao desse acervo real. Servicos Supabase/Auth, integracoes externas e rollback operacional completo nao foram testados. A corrida entre sessoes reais foi acrescentada na revisao abaixo; a estrategia de restauracao de producao ainda precisa de revisao humana. Nenhum teste global ou frontend foi executado.

Resultado da primeira entrega: migration aplicada/reaplicada com exit 0; fixture com **47 assercoes passando, 0 falhando, exit 0**. Inspecao apos `ROLLBACK`: 0 usuarios sinteticos, 0 cortes, 0 programas e 0 triggers de falha sinteticos no clone. Assercoes incluem numero/campo do erro da segunda linha invalida, fonte/label por resultado, estatisticas isoladas por referencia, ownership, ACLs privadas e preservacao das definicoes/owners/ACLs originais. A revisao abaixo mantem os tres arquivos originais e acrescenta somente os dois scripts explicitamente autorizados.

## Evidencia Independente Codex

Informacao recebida do orquestrador na revisao independente F1-5: Codex aplicou a migration e a fixture em seu proprio clone `enamed_test_cutoff_codex_20261104`, com **exit 0, 47 assercoes passando e legado nulo preservado**. Essa evidencia corresponde a versao anterior a correcao de atomicidade do arquivo. Nao foi produzida por esta execucao, nao comprova os novos negativos/concorrencia e esse banco nao foi alterado, consultado nem limpo por este job.

## Revisao De Atomicidade

Novos arquivos: `scripts/sql-local/cutoff-concurrency.mjs` e `.test.mjs`. Nenhum outro harness foi alterado. O runner exige clone **pristino** do template `enamed_test_f1_target_review_20261104`, sem a expansao instalada; nao cria nem remove bancos. Guardas JS e SQL exigem exatamente `127.0.0.1:54737`, `session_user=postgres` e banco com prefixo `enamed_test_cutoff_`. Nomes invalidos, host remoto/localhost, outra porta ou outro usuario sao recusados antes de spawn. Overrides PG herdados sao removidos; nao se leem arquivos `.env`, services ou credenciais. SQLs resolvem via `import.meta.url`; o executavel usa o caminho portatil confirmado acima, independentemente do cwd.

O harness executa o **arquivo real** com `psql -f`, sem `-1`, em dois negativos de primeira aplicacao:

- View com dependencia catalogada na **segunda RPC antiga** (`get_user_cutoff_context(uuid)`): preflight gera erro esperado, exit 3.
- Assinatura expandida da **segunda RPC** com retorno conflitante: a migration chega a remover a primeira assinatura antiga e criar seu replacement, mas falha no segundo `CREATE FUNCTION`, exit 3.

Antes/depois de cada erro sao comparados fingerprints de schemas, colunas, tabelas/ACL/RLS, indices, constraints, triggers, RPCs (corpo, OID, owner, ACL) e checkpoints de cortes/programas legados com fonte desconhecida. Nenhum estado parcial fica confirmado. Objetos de injecao e checkpoints usam UUIDs/nomes proprios e sao retirados por nome/ID exato; sem `CASCADE` ou limpeza por prefixo.

TDD desta revisao: o teste novo falhou no clone proprio `enamed_test_cutoff_61e4_atomic_red` contra o arquivo antigo, **exit 1**, mostrando fingerprints diferentes apos erro de dependencia. Depois de envolver o arquivo no unico statement, ambos os negativos passaram, preservando o estado anterior. O clone vermelho, criado exclusivamente por este job, foi removido por nome exato apos fechar as conexoes; nenhum banco de outro job foi removido.

Em seguida o runner aplica a migration com `psql -f` e roda a fixture/reapply: **47 assercoes, exit 0**. A fixture cria `SAVEPOINT cutoff_reapply_caller` antes do reapply e exige `RELEASE` depois, detectando um eventual COMMIT indevido. Um observador externo compara checkpoint completo antes/depois do `ROLLBACK` e verifica ausencia dos dois usuarios de fixture. Portanto sucesso de reapply nao e confundido com confirmacao dos seeds.

## Concorrencia Real

O harness mantem no maximo **duas conexoes psql simultaneas**, com `statement_timeout=8s`, `lock_timeout=6s`, timeout cliente de 12s e barreira observada em ate 4s. O proprio holder observa o waiter. As barreiras consultam `pg_stat_activity`, `pg_locks` (advisory nao concedido e holder da mesma chave) e `pg_blocking_pids`; snapshots de estatisticas sao explicitamente renovados. Nao ha sleep como prova de bloqueio nem troca do helper de autorizacao.

- **READ COMMITTED, mesma referencia/chave:** A importa dois cenarios e segura a transacao; B pede um cenario exclusivo mais um conflitante e e observado esperando o advisory de A. A confirma. B retorna `{ok:false, imported:0, errors:[{row:2, field:"practice_scenario", message:"Reference key already exists"}]}`. Banco: A tem 2 cortes/2 programas/1 auditoria; B tem 0 cortes/0 programas.
- **REPEATABLE READ, snapshot antigo:** B fixa snapshot antes do commit de A e espera o mesmo advisory. Apos adquirir o lock, seu snapshot nao ve o conflito no precheck; o indice unique e a autoridade final. B insere seu primeiro cenario exclusivo e falha no segundo com `23505`; a resposta estruturada indica linha 2/campo `insert`, `imported=0`. A subtransacao desfaz tambem o primeiro corte/programa do lote perdedor. Banco: somente 2/2 do vencedor e uma auditoria. O advisory nao substitui a semantica de snapshots ou constraints.
- **Referencias diferentes:** A continua com a transacao/lock abertos enquanto B importa outra referencia com `lock_timeout=750ms`. B termina sem esperar liberacao de A; o observador confirma ambos os advisory locks concedidos, B `idle in transaction` e nenhum blocking PID. Ambos fazem rollback nesse caso; nao existe serializacao global de importacoes.

Os IDs de usuario, instituicao, especialidade e referencias sao UUIDs novos desta invocacao. Autorizacao usa `authenticated`, `content_editor`, JWT sub e `admin_require/content.manage` reais; somente o setup local suspende triggers de integracao no insert de `auth.users`. Finally fecha as duas sessoes, remove apenas esses IDs/auditorias/linhas e verifica zero remanescentes; nao limpa dados de outros jobs.

## Resultado Da Revisao

Execucoes verdes em clones proprios `enamed_test_cutoff_61e4_atomic_green` e `enamed_test_cutoff_61e4_atomic_final`, ambos derivados do template autorizado. Comando do runner (usar clone novo a cada execucao completa):

```powershell
$env:CUTOFF_REVIEW_DATABASE = 'enamed_test_cutoff_61e4_atomic_final'
node --test scripts/sql-local/cutoff-concurrency.test.mjs
```

Resultado final: **2 testes Node passando, 0 falhando, 0 skipped, exit 0**, incluindo os dois negativos SQL esperados (exit 3), aplicacao direta, fixture de 47 assercoes e tres cenarios concorrentes. A segunda rodada foi executada com cwd fora do repositorio e caminho absoluto para o `.test.mjs`, comprovando resolucao dos SQLs independente do cwd. Permanecem instalados apenas os objetos reais da migration nos clones verdes; os dados sinteticos foram removidos. Nao houve globais, instalacao, rede externa, commit, deploy ou alteracao de producao. **D6 continua externo: nenhuma fonte 2026/Enare foi inferida.**
