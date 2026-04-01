

## Plan: Central de Admin (`/admin`) — Arquitetura Completa

### Visão geral

Criar um painel administrativo totalmente isolado do fluxo de usuários, com autenticação própria baseada em roles (tabela `user_roles`), contendo dashboard, CRUD de simulados e upload de planilha XLSX para popular questões.

### Arquitetura de segurança

O admin usa a mesma autenticação Supabase (email+senha), mas com uma camada de autorização via tabela `user_roles`. Não é um login separado — é o mesmo auth, com gate de role `admin`.

```text
/admin/login  →  Login normal (email+senha via Supabase Auth)
                  ↓
              Verifica role 'admin' na tabela user_roles
                  ↓
              Se admin → /admin (dashboard)
              Se não   → "Acesso negado"
```

### Banco de dados (migrações)

**1. Criar enum `app_role` e tabela `user_roles`**

```sql
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
```

**2. Criar função `has_role` (SECURITY DEFINER)**

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

**3. RLS policies para `user_roles`**

```sql
CREATE POLICY "Admins can read roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

**4. RLS policies para tabelas de admin** (simulados, questions, question_options)

Adicionar policies de INSERT/UPDATE/DELETE para admins nas tabelas `simulados`, `questions`, `question_options` usando `has_role(auth.uid(), 'admin')`.

**5. Inserir o primeiro admin manualmente**

Após a migração, inserir o user_id do admin via SQL Editor do Supabase.

### Estrutura de arquivos

```text
src/
├── admin/
│   ├── AdminApp.tsx              # Layout + rotas do admin
│   ├── AdminGuard.tsx            # Verifica role admin, redireciona se não
│   ├── AdminLoginPage.tsx        # Tela de login do admin
│   ├── hooks/
│   │   └── useAdminAuth.ts       # Hook: verifica has_role + loading
│   ├── pages/
│   │   ├── AdminDashboard.tsx    # Dashboard com KPIs
│   │   ├── AdminSimulados.tsx    # Lista de simulados + CRUD
│   │   ├── AdminSimuladoForm.tsx # Criar/editar simulado (config)
│   │   └── AdminUploadQuestions.tsx # Upload XLSX + preview + associar
│   ├── components/
│   │   ├── AdminSidebar.tsx      # Navegação lateral
│   │   ├── AdminHeader.tsx       # Header com user info
│   │   ├── SimuladoTable.tsx     # Tabela de simulados
│   │   └── UploadPreview.tsx     # Preview da planilha antes de salvar
│   └── services/
│       └── adminApi.ts           # Queries admin (CRUD simulados, questions)
```

### Rotas (em App.tsx)

```text
/admin/login   → AdminLoginPage (público)
/admin         → AdminGuard → AdminApp (layout com sidebar)
  /admin/          → AdminDashboard
  /admin/simulados → AdminSimulados (lista)
  /admin/simulados/novo → AdminSimuladoForm (criar)
  /admin/simulados/:id  → AdminSimuladoForm (editar)
  /admin/simulados/:id/questoes → AdminUploadQuestions
```

### Funcionalidades do Admin

**Dashboard**
- Total de simulados cadastrados
- Total de usuários (count de profiles)
- Total de tentativas (attempts)
- Simulados ativos (janela aberta)
- Próximo simulado

**CRUD de Simulados**
- Formulário com: título, slug, sequence_number, description, duration_minutes, execution_window_start/end, results_release_at, theme_tags, questions_count
- Status: draft/published (o campo já existe como enum)
- Criar simulado "vazio" (sem questões) para reservar a data

**Upload de Questões (XLSX)**
- Aceita planilha com colunas: `numero`, `texto`, `area`, `tema`, `dificuldade`, `explicacao`, `alternativa_a`, `alternativa_b`, `alternativa_c`, `alternativa_d`, `alternativa_e`, `correta`
- Preview em tabela antes de confirmar
- Parsing client-side com `xlsx` (SheetJS)
- Ao confirmar: chama Edge Function que faz bulk insert de questions + question_options (admin precisa de INSERT nessas tabelas)
- Associa ao simulado selecionado e atualiza `questions_count`

### Detalhes técnicos

- **Lib XLSX**: instalar `xlsx` (SheetJS) para parsing client-side da planilha
- **Edge Function `admin-upload-questions`**: recebe JSON com array de questões parseadas + simulado_id, valida role admin via JWT, faz bulk insert usando service_role_key
- **AdminGuard**: chama RPC `has_role(auth.uid(), 'admin')` e redireciona para `/admin/login` se false
- **Login do admin**: mesma tela de login simplificada, mas após auth verifica role e redireciona para `/admin` ou mostra erro
- **Sem interferência no fluxo normal**: rotas `/admin/*` são completamente separadas, sem compartilhar layout/providers do dashboard premium

### Arquivos editados/criados

- `src/App.tsx` — adicionar rotas `/admin/*`
- `src/admin/**` — todos os arquivos novos (~15 arquivos)
- `supabase/migrations/` — migração para user_roles + RLS policies de admin
- `supabase/functions/admin-upload-questions/index.ts` — edge function para bulk insert
- `package.json` — adicionar dependência `xlsx`

