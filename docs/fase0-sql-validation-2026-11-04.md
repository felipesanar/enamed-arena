# Ensaio SQL da Fase 0 — 04/11/2026

As seis fixtures da Fase 0 passaram em PostgreSQL portátil 17.11, restrito a 127.0.0.1:54737, com catálogo público restaurado a partir de metadados reais consultados em leitura. Nenhuma migration ou extensão foi aplicada em produção.

| Bloco | Resultado local |
| --- | --- |
| T1 edições e ACL | Passou |
| T2 integridade de tentativa, respostas e ranking | Passou |
| T3 liberação de questões, comentários e gabarito | Passou |
| T4 finalização e fila | Passou |
| T5 preservação de histórico | Passou |
| T6 Vault, HTTP e agendamento | Passou em banco vazio separado, com doubles |
| Correção de auditoria de conteúdo | 93 asserções e verificações RLS passaram; reaplicação também passou |

O ensaio encontrou um defeito existente em `tg_admin_audit`: a expressão CASE referenciava campos de tabelas diferentes no registro NEW, quebrando gravações autenticadas. A nova migration `20261104073257_fase0_admin_audit_record_fix.sql` usa projeção JSON explícita e mantém identidade, privilégios, retorno correto por operação e propagação de falhas. Registra before/after/diff dos campos de conteúdo permitidos. A reprodução vermelha e a correção verde foram executadas; depois, o orquestrador repetiu o teste no catálogo completo e T2 passou até o fim.

O harness está em `scripts/sql-local/`; instruções e limites em [sql-local-validation.md](sql-local-validation.md). Não exige Docker. Os nomes de banco, host, porta, papéis e caminhos extras são conferidos antes da execução. Os logs locais são ignorados no Git, sem credenciais de produção. A entrada de catálogo deve ser revisada/sanitizada pelo operador antes de ser fornecida.

A rodada completa Unicode foi `20261104075418503_34180`; o teste isolado T6 foi `20261104075437199_36368`. O catálogo foi verificado antes das expansões. ICU/en-US reproduz a normalização Unicode necessária no Windows, mas não comprova igualdade integral com a ordenação libc/en_US.UTF-8 de produção.

Os serviços gerenciados Auth, Storage, Vault, pg_net e pg_cron têm doubles locais explícitos. Isso valida os contratos e guards exercitados, sem comprovar worker cron, HTTP real, envio HubSpot/Novu, JWKS ou permissões REST em Supabase ao vivo. O teste concorrente em duas conexões está em implementação na Fase 1.

O replay histórico direto ainda falha em `20260326170737_195942cb-4eaa-4693-8eb4-4f86564529ff.sql` por trigger duplicado, após dez migrations anteriores passarem. Essa falha foi reproduzida e permanece registrada; não foi ocultada por skip. O baseline completo do drift não está concluído, e nenhuma migration antiga foi arquivada.

Produção continua pendente das autorizações específicas e da ordem banco → Edge Functions → frontend descritas no handoff. Tentativas legadas, SSO e funções one-off não foram alterados por este ensaio.
