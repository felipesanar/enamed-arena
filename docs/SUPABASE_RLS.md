# Supabase RLS (Row Level Security) — Auditoria

Última revisão: 2026-03-17

## Resumo

Todas as tabelas públicas possuem RLS habilitado com políticas restritivas. Dados de usuário são isolados por `auth.uid()`. Dados compartilhados (simulados, questões, opções) são somente leitura para usuários autenticados.

## Políticas por tabela

### `profiles`
| Operação | Condição |
|----------|----------|
| SELECT | `auth.uid() = id` |
| INSERT | `auth.uid() = id` |
| UPDATE | `auth.uid() = id` (qual + with_check) |

### `onboarding_profiles`
| Operação | Condição |
|----------|----------|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` |
| UPDATE | `auth.uid() = user_id` (qual + with_check) |

### `attempts`
| Operação | Condição |
|----------|----------|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` |
| UPDATE | `auth.uid() = user_id` |

### `answers`
| Operação | Condição |
|----------|----------|
| SELECT | via JOIN: `attempts.user_id = auth.uid()` |
| INSERT | via JOIN: `attempts.user_id = auth.uid()` |
| UPDATE | via JOIN: `attempts.user_id = auth.uid()` |

### `error_notebook`
| Operação | Condição |
|----------|----------|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` |
| UPDATE | `auth.uid() = user_id` |

### `simulados` (somente leitura)
| Operação | Condição |
|----------|----------|
| SELECT | `status = 'published'` (qualquer autenticado) |

### `questions` (somente leitura)
| Operação | Condição |
|----------|----------|
| SELECT | qualquer autenticado |

### `question_options` (somente leitura)
| Operação | Condição |
|----------|----------|
| SELECT | qualquer autenticado |

## RPC: `get_ranking_for_simulado`

- **SECURITY DEFINER** — executa com permissões do owner, contornando RLS.
- Retorna apenas dados de ranking público (nome, nota, posição) para um simulado.
- Não expõe dados sensíveis (email, avatar, etc.).
- Filtra apenas tentativas com status `submitted`/`expired` e `score_percentage IS NOT NULL`.

## Observações

- Nenhuma tabela permite acesso anônimo (todas exigem `authenticated`).
- A tabela `answers` valida propriedade via JOIN com `attempts`, impedindo inserção em tentativas de outros usuários.
- O trigger `handle_new_user` é `SECURITY DEFINER` e apenas cria o perfil na inserção em `auth.users`.
