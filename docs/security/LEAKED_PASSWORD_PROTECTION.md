# Leaked Password Protection (Supabase Auth)

Status em 2026-04-04: **pendente de validação no Dashboard**.

## Contexto

O alerta "Leaked Password Protection Disabled" não é controlado por migration SQL no repositório.
Essa opção é gerenciada no Dashboard do Supabase (Auth), portanto precisa de validação operacional.

## Checklist de validação/habilitação

1. Acessar o projeto no Supabase Dashboard.
2. Ir em `Authentication` -> `Providers` -> `Email`.
3. Localizar a opção de proteção contra senhas vazadas (`Leaked password protection`).
4. Garantir que a opção está **habilitada**.
5. Salvar as alterações.
6. Registrar evidência (print ou changelog interno) com data e responsável.

## Critério de aceite

- Opção habilitada no Dashboard.
- Evidência registrada no processo interno de segurança.
