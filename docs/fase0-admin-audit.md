# Auditoria de Conteudo: Fase 0

> **Proposito:** Explicar a correcao do trigger polimorfico e reproduzir sua regressao localmente.
> **Audiencia:** Orquestrador, revisores SQL e QA.
> **Ultima revisao:** 2026-11-04.

## Causa e Contrato

O `CASE TG_TABLE_NAME` anterior acessava `NEW.title`, `NEW.question_number` e
`NEW.label` na mesma expressao SQL. O planejamento resolve campos de branches
nao executados: uma escrita em `simulados` ou `question_options` pode falhar com
`record "new" has no field "question_number"`.

A [migration](../supabase/migrations/20261104073257_fase0_admin_audit_record_fix.sql)
substitui apenas `public.tg_admin_audit()`. Os tres triggers existentes continuam
`AFTER INSERT OR DELETE OR UPDATE`, por linha, em `simulados`, `questions` e
`question_options`. Nenhuma migration antiga, RPC de prova, tentativa, ranking,
score, Edge Function ou integracao HTTP foi alterada.

- `OLD` e convertido em JSON somente em UPDATE/DELETE; `NEW`, somente em INSERT/UPDATE.
- DELETE retorna `OLD`; as demais operacoes retornam `NEW`, inclusive sem identidade.
- O resumo usa o estado final em INSERT/UPDATE e o anterior em DELETE; texto e tratado como dado, nunca como SQL dinamico.
- `entity_id` vem do `id` desse mesmo estado, convertido para UUID; `action` e `entity_type` continuam `TG_OP` e `TG_TABLE_NAME`.
- A identidade continua sendo resolvida por `admin_log_action`: `auth.uid()` e email de `auth.users`, nunca valores do registro editado.
- `auth.uid() IS NULL` continua sendo manutencao sem evento, sem inventar ator. Isso nao resolve a lacuna de auditoria de service role sem JWT.
- Erros da auditoria propagam e desfazem a escrita de conteudo. Nao existe `WHEN OTHERS` para mascarar falhas.

## Metadata e Acesso

Cada evento inclui `op`, `before`, `after` e `diff`. INSERT tem `before: null`;
DELETE tem `after: null`. `diff` e um objeto por campo alterado, com `before` e
`after`; UPDATE sem mudanca de conteudo produz `{}`. Identificadores e relacoes
fazem parte dos snapshots; timestamps tecnicos nao geram ruido no diff.

Exemplo de alteracao de gabarito:

```json
{"op":"UPDATE","diff":{"is_correct":{"before":true,"after":false}}}
```

Os snapshots usam lista explicita de campos:

| Tabela | Conteudo incluido |
| --- | --- |
| `simulados` | id, title, slug, sequence_number, description, questions_count, duration_minutes, execution_window_start/end, results_release_at, theme_tags, status |
| `questions` | id, simulado_id, question_number, text, area, theme, difficulty, explanation |
| `question_options` | id, question_id, label, text, is_correct |

URLs de imagens ficam fora para evitar persistir URLs assinadas. Colunas futuras
nao entram automaticamente, nem dados de estudantes/tentativas. O conteudo livre
e preservado literalmente, sem sanitizacao semantica: autores nao devem inserir
segredos ou dados pessoais nos proprios enunciados. O email do ator ja integra o
contrato anterior do log e nao e duplicado em metadata.

O catalogo consultado tem RLS em `admin_audit_log` e SELECT condicionado a
`has_capability('audit.view')`; apenas `admin` possui essa capability no recorte.
A funcao continua `SECURITY DEFINER`, com `search_path = pg_catalog, public,
pg_temp`; acessos a tabelas/helper estao qualificados. `CREATE OR REPLACE`
preserva owner e ACL explicita, e a migration revoga execucao de PUBLIC, anon e
authenticated; preserva a execucao existente de postgres/service_role.

`admin_log_action` e `has_capability` nao foram alteradas. A capability de leitura
nao foi transformada em requisito de escrita: editores autorizados a alterar
conteudo devem continuar gerando logs mesmo sem poder le-los. A autorizacao da
escrita original permanece nas RLS/RPCs existentes. A ACL autenticada do helper,
capturada no catalogo, nao e ampliada nem redesenhada por esta correcao.

## Fontes e Limites

Fonte: `production-schema.json` do worktree `fase1-edicoes`, em
`.superpowers/editions/`, extraindo somente funcoes, colunas, constraints,
triggers, ACL e policy relacionados. As definicoes de criacao destes tres
triggers e funcoes nao foram encontradas nas migrations versionadas deste
worktree; o catalogo e a referencia efetiva, nao uma reconstrucao a partir do
historico incompleto. O desenho tambem consta no
[plano de auditoria admin](superpowers/plans/2026-06-15-admin-gestao.md).

Validacao realizada no PostgreSQL **17.11**, em
`enamed_test_audit_48ce_20261104072952`, exclusivamente via `127.0.0.1:54737`.
Esse banco foi criado para este job, sem alterar bancos de outros jobs.
O schema minimo usa as colunas/defaults/constraints catalogadas das seis tabelas
de conteudo, log e capabilities, os dois enums relevantes, as definicoes das
funcoes `tg_admin_audit`, `admin_log_action`, `has_capability` e os tres triggers.
`auth.users`/`auth.uid()` sao stubs locais de identidade e claims. A policy de
leitura e os grants relevantes foram reproduzidos. Nao e restauracao completa
do Supabase, nem replay integral da Fase 0, nem evidencia sobre producao.

A fixture faz DML como postgres com identidade JWT para isolar o trigger; somente
a verificacao de visibilidade troca para o papel `authenticated`. Nao certifica
RLS de escrita, todas as variantes de claims reais ou RPCs administrativas.
As verificacoes de `RETURNING` confirmam operacoes efetivas; o retorno de um
trigger AFTER e ignorado pelo PostgreSQL, entao NEW/OLD tambem exige revisao do
corpo da funcao. T2 e demais fixtures ficam para o replay completo do QA.

## Execucao Local

A [fixture transacional](../supabase/tests/fase0_admin_audit.sql) exige nome de
banco `enamed_test_*`, endereco `127.0.0.1` e porta `54737`, e termina em ROLLBACK.
Nao depende de pgTAP. Executar da raiz deste worktree, com o banco descartavel
ja preparado. Estes sao os caminhos e banco usados nesta execucao:

```powershell
$pg = 'C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe'
$db = 'enamed_test_audit_48ce_20261104072952'
$migration = 'supabase/migrations/20261104073257_fase0_admin_audit_record_fix.sql'
$fixture = 'supabase/tests/fase0_admin_audit.sql'
& $pg -X -w -h 127.0.0.1 -p 54737 -U postgres -d $db -v ON_ERROR_STOP=1 -f $migration -f $fixture -f $migration -f $fixture
$LASTEXITCODE
```

Resultado final: exit **0**, **93 asserts + 2 verificacoes RLS** passando por
execucao, tanto apos aplicar quanto apos reaplicar. Cobre nove eventos com ator
(tres tabelas x tres operacoes), nove mutacoes sem ator, entidade/identidade,
texto com aspas/HTML/quebra de linha/acento, snapshots e diff exatos, mudanca de
janela, explicacao NULL para texto, gabarito, ACL, restricao de leitura e falha
forcada do log desfazendo a insercao original. Os dados da fixture foram revertidos.

Antes da implementacao, a fixture falhou contra a definicao antiga com
`record "new" has no field "question_number"`. A contraprova final substituiu
temporariamente a funcao antiga dentro de transacao e retornou exit **3** no
mesmo erro; a desconexao reverteu essa substituicao. O literal acentuado do resumo
foi representado por escape SQL Unicode para evitar conversao de encoding do
PowerShell/psql. Uma tentativa de injecao textual sem esse escape terminou em
erro de encoding (exit 1), sem aplicar alteracoes; nao conta como prova do bug.

## Rollback e QA

O final da migration contem SQL de rollback **inteiramente comentado**, para
restauracao manual da implementacao anterior. Esse rollback reintroduz
explicitamente o bug de RECORD e remove o diff para eventos futuros; nao apaga
historico nem triggers. Nao foi executado como rollback persistente; preferir
correcao adiante. Reaplicar esta migration apos qualquer ensaio de rollback.

Pendencia do orquestrador/QA: aplicar a migration em banco descartavel restaurado
do catalogo completo com F0, rodar esta fixture e repetir `fase0_exam_integrity.sql`
(T2), incluindo o ponto que falhou em `question_options`. Nao aplicar nada em
producao com base apenas neste ensaio minimo. O indice documental nao foi
alterado porque esta tarefa autoriza somente estes tres arquivos novos.
