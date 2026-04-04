# Supabase RLS (Row Level Security) — Auditoria

Última revisão: 2026-04-04

## Resumo

As policies foram reforçadas para mitigar os alertas do Lovable em abril/2026.  
Principais mudanças:

- `question_options`: usuários autenticados não têm mais permissão para ler a coluna `is_correct`.
- `attempt_processing_queue`: INSERT agora exige ownership real do `attempt_id`.
- `sso_rate_limit`: passou a usar `email_hash` (sem e-mail em claro), com política explícita para `service_role`.

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

### `question_options` (somente leitura parcial)
| Operação | Condição |
|----------|----------|
| SELECT (linhas) | somente opções de questões de simulados publicados |
| SELECT (colunas) | `id`, `question_id`, `label`, `text`, `created_at` para `authenticated` |
| `is_correct` | **bloqueada para `authenticated`** (sem privilégio de coluna) |

### `attempt_processing_queue`
| Operação | Condição |
|----------|----------|
| SELECT | `user_id = auth.uid()` |
| INSERT | `user_id = auth.uid()` **e** `attempt_id` pertence ao `auth.uid()` |
| UPDATE | bloqueado para `authenticated` |

### `sso_rate_limit`
| Operação | Condição |
|----------|----------|
| RLS | habilitado |
| Políticas | policy explícita apenas para `service_role` (`FOR ALL`) |
| PII | e-mail em claro removido; apenas `email_hash` |

## RPC: `get_ranking_for_simulado`

- **SECURITY DEFINER** — executa com permissões do owner, contornando RLS.
- Retorna apenas dados de ranking público (nome, nota, posição) para um simulado.
- Não expõe dados sensíveis (email, avatar, etc.).
- Filtra apenas tentativas com status `submitted`/`expired` e `score_percentage IS NOT NULL`.

## Observações

- Nenhuma tabela de domínio do aluno permite acesso anônimo.
- `answers` valida ownership via JOIN com `attempts`.
- O trigger `handle_new_user` é `SECURITY DEFINER` e apenas cria o perfil na inserção em `auth.users`.
- **Leaked password protection** é configuração de Dashboard (Auth) e não pode ser validada apenas por migration SQL no repositório.
