

## Plan: Importar dados ENAMED/ENARE e redesenhar onboarding com instituições reais

### Objetivo

Criar tabelas no banco para armazenar programas e instituições do ENAMED/ENARE a partir da planilha CSV (~1050 linhas), substituir os dados mock estáticos, e redesenhar o Step 2 do onboarding para que o ENARE apareça como primeira opção e, ao selecioná-lo, exiba as instituições correlacionadas.

### Dados da planilha

| Coluna | Uso |
|---|---|
| `Programa` | Especialidades (usadas em toda a plataforma) |
| `Instituição` | Instituições que ofertam no ENAMED/ENARE |
| `UF` | Estado da instituição |
| `Vagas` | Total de vagas ofertadas |
| `Cenário de prática` | Local de prática (informativo) |

### Arquitetura

```text
┌─────────────────────────┐
│  enamed_specialties     │  ~40 especialidades distintas
│  id, name, slug         │
└─────────────────────────┘
          │ 1:N
┌─────────────────────────────────────────┐
│  enamed_institutions                     │
│  id, name, uf, slug                      │  ~300 instituições distintas
└─────────────────────────────────────────┘
          │ N:M
┌─────────────────────────────────────────┐
│  enamed_programs                         │  ~1050 linhas (CSV completo)
│  id, specialty_id, institution_id,       │
│  vagas, cenario_pratica                  │
└─────────────────────────────────────────┘
```

### Plano de implementação

**1. Migração: criar tabelas `enamed_specialties`, `enamed_institutions`, `enamed_programs`**
- Tabelas públicas, RLS com SELECT para qualquer authenticated (dados de referência)
- `enamed_specialties`: `id uuid PK`, `name text UNIQUE`, `slug text UNIQUE`
- `enamed_institutions`: `id uuid PK`, `name text`, `uf text`, `slug text UNIQUE`
- `enamed_programs`: `id uuid PK`, `specialty_id FK`, `institution_id FK`, `vagas int`, `cenario_pratica text`
- Índices em `specialty_id` e `institution_id` para queries rápidas

**2. Script de seed: popular tabelas com dados da planilha**
- Ler o CSV, extrair especialidades e instituições distintas, gerar slugs
- Inserir via `psql` usando INSERT statements
- ~40 especialidades, ~300 instituições, ~1050 programas

**3. Criar hooks de dados: `useEnamedData`**
- Arquivo: `src/hooks/useEnamedData.ts`
- Query via React Query para buscar especialidades e instituições do banco
- Função `getInstitutionsBySpecialty(specialtyName)` para filtrar no Step 2
- Cache com staleTime longo (dados de referência, raramente mudam)

**4. Redesenhar onboarding Step 2 (Instituições)**
- Arquivo: `src/pages/OnboardingPage.tsx`
- Primeiro item da lista: **"ENARE"** como opção principal (tipo toggle)
- Ao selecionar ENARE, exibe as instituições que ofertam a especialidade escolhida no Step 1
- Instituições agrupadas por UF com contagem de vagas
- Manter "Ainda não sei" como opção
- Máximo de 3 instituições selecionadas (mantém regra atual)

**5. Atualizar Step 1 (Especialidade) para usar dados reais**
- Substituir `SPECIALTIES` do mock por dados do banco (`enamed_specialties`)
- Manter UX idêntica, só troca a fonte de dados

**6. Remover dados mock obsoletos**
- Arquivo: `src/data/mock.ts` — remover `SPECIALTIES` e `INSTITUTIONS`
- Atualizar imports em qualquer arquivo que reference esses arrays

**7. Admin: adicionar página para re-importar dados ENAMED**
- Arquivo: `src/admin/pages/AdminEnamedImport.tsx`
- Upload de CSV com validação de colunas
- Preview dos dados antes de confirmar
- Truncate + re-insert atômico (via edge function ou RPC admin)
- Isso garante que dados possam ser atualizados a cada edital

### Fluxo do onboarding redesenhado

```text
Step 1: Escolher especialidade (dados reais do banco)
         ↓
Step 2: Escolher instituições
         ├── [ENARE] ← primeiro, sempre visível
         │     └── ao clicar: mostra instituições que ofertam
         │         a especialidade do Step 1, agrupadas por UF
         ├── [Ainda não sei]
         └── Busca por nome de instituição
         ↓
Step 3: Confirmação (igual atual)
```

### Detalhes técnicos

- **RLS**: SELECT para `authenticated`, INSERT/UPDATE/DELETE apenas para `admin` (via `has_role`)
- **Slug**: gerado como `slugify(name)` para evitar duplicatas e facilitar lookups
- **Normalização**: nomes de instituições com case inconsistente no CSV serão normalizados (trim, title case)
- **Fallback**: se a query falhar, o onboarding mostra mensagem de erro e botão de retry (sem crashar)
- **onboarding_profiles**: continua salvando `specialty` e `target_institutions` como strings (nomes), sem FK — mantém compatibilidade com dados existentes

### Arquivos criados/editados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/` | Nova migração com 3 tabelas + RLS |
| Script seed (psql) | Popular dados do CSV |
| `src/hooks/useEnamedData.ts` | Novo hook para consultar dados |
| `src/pages/OnboardingPage.tsx` | Redesenhar Steps 1 e 2 |
| `src/data/mock.ts` | Remover SPECIALTIES e INSTITUTIONS |
| `src/admin/pages/AdminEnamedImport.tsx` | Página admin para re-importação |
| `src/admin/AdminApp.tsx` | Adicionar rota de importação ENAMED |

### Riscos e mitigações

- **CSV com nomes inconsistentes**: normalização com trim + uppercase para matching
- **Dados existentes em `onboarding_profiles`**: sem impacto, campos são strings livres
- **Performance**: ~1050 linhas no total, query leve; cache de 30min via React Query

