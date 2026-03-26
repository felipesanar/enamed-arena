# Review - Auditoria Dados (Round 2)

## Blocker
- Nenhum no codigo local.

## Major
- Migracoes pendentes de aplicacao no Supabase:
  - `20260326143000_server_side_exam_finalization_and_performance.sql`
  - `20260326152000_attempt_results_and_reprocessing_queue.sql`
  Sem isso, RPCs/tabelas novas nao existem no ambiente.

## Minor
- Reprocessamento automatico foi implementado via fila + funcao processadora (`process_attempt_reprocessing_queue`), mas depende de agendamento externo (cron/job) para rodar continuamente em producao.
- Correcoes por questao agora sao persistidas (`attempt_question_results`), mas UI ainda consome majoritariamente `answers + question_options` para exibicao detalhada.

## Nit
- Nenhum.
