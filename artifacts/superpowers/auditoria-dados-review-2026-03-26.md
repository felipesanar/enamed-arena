# Review - Auditoria Dados (2026-03-26)

## Blocker
- Nenhum.

## Major
- **Dependencia de deploy de migracao**: as novas chamadas RPC (`finalize_attempt_with_results`, `get_user_performance_*`) exigem aplicacao da migracao `supabase/migrations/20260326143000_server_side_exam_finalization_and_performance.sql` no ambiente alvo. Sem isso, a finalizacao server-side falha.

## Minor
- **Evolucao textual no Desempenho**: a secao "Evolucao recente" mostra string simples (`x% -> y%`) e pode evoluir para visualizacao em grafico.
- **Integridade por contagem de respostas**: verificacao atual valida persistencia de IDs de questao presentes no estado final; nao valida checksums adicionais de payload (opcao marcada, flags) item a item.

## Nit
- Nenhum.
