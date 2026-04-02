

# Fix crítico: Signup quebrado pelo trigger do HubSpot

## Problema

O trigger `on_profile_created_hubspot` que criamos está quebrando **todo cadastro de usuário** com erro 500. Os logs mostram:

```
ERROR: function extensions.http_post(url => text, body => jsonb, headers => jsonb) does not exist (SQLSTATE 42883)
```

A migration usou `extensions.http_post()` mas a função correta do `pg_net` é `net.http_post()` com assinatura diferente. Como o trigger roda dentro da transação de signup, o erro aborta a criação do usuário inteiro.

## Solução

Uma única migration SQL que:

1. **Remove o trigger quebrado** (`on_profile_created_hubspot`)
2. **Remove a function quebrada** (`notify_hubspot_new_user`)
3. **Recria a function** usando `net.http_post()` com a assinatura correta do pg_net
4. **Recria o trigger** na tabela `profiles`

A function corrigida usará:
```sql
PERFORM net.http_post(
  url := '...',
  body := '...'::jsonb,
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb
);
```

`net.http_post` do pg_net é **assíncrono** — não bloqueia a transação e não causa rollback se o HTTP falhar, eliminando o risco de quebrar signups futuros.

## Arquivos alterados

- 1 nova migration SQL (drop + recreate trigger e function)

Nenhuma alteração no frontend ou edge functions.

