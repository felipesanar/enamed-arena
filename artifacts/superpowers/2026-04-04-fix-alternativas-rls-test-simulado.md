# Correção: alternativas vazias em simulado teste

## Causa

- Migração `20260404203000_security_hardening_lovable_alerts.sql` criou RLS em `question_options` apenas para `simulados.status = 'published'`.
- `questions` mantém política permissiva (`USING (true)`), então o enunciado carrega.
- `create_attempt_guarded` aceita `published` e `test` — simulados de teste ficam sem linhas de `question_options` visíveis ao cliente.

## Correção

- Nova migração: `20260405103000_question_options_rls_include_test_simulados.sql` — política `IN ('published', 'test')`.
- UI: `QuestionDisplay` mostra estado vazio acessível se `options.length === 0`.

## Verificação pós-deploy (produção)

1. Aplicar migração no projeto Supabase.
2. Abrir Simulado Teste, entrar na prova, confirmar alternativas visíveis.
3. `npm run lint` e `npm run test` no repo.
