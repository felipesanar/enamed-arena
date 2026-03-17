# Simulados SanarFlix / PRO: ENAMED

Plataforma de simulados para residência médica. Usuários realizam provas cronometradas, consultam resultados, ranking, desempenho por área/tema e (assinantes PRO) Caderno de Erros e comparativo entre simulados.

## Stack

- **Build:** Vite 5, TypeScript
- **UI:** React 18, React Router 6, shadcn/ui (Radix), Tailwind CSS, Framer Motion
- **Estado:** TanStack React Query, Context (Auth, User)
- **Backend:** Supabase (Auth + Postgres)
- **Testes:** Vitest, Testing Library, Playwright (Lovable)

## Variáveis de ambiente

Copie o exemplo e preencha com os valores do seu projeto Supabase:

```sh
cp .env.example .env
```

Edite `.env` e defina:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | Sim | URL do projeto (ex.: `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sim | Chave anônima (anon/public) do Supabase |
| `VITE_SUPABASE_PROJECT_ID` | Não | ID do projeto (opcional, para scripts) |

**Importante:** Nunca commite o `.env` com valores reais. O `.env.example` contém apenas placeholders.

## Como rodar

```sh
# Instalar dependências
npm i

# Desenvolvimento (porta 8080)
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview

# Testes unitários
npm run test
```

## Estrutura resumida

- **`src/App.tsx`** — Rotas e providers (Query, Auth, User, Router).
- **`src/contexts/`** — AuthContext (login/sessão), UserContext (perfil e onboarding).
- **`src/pages/`** — Páginas por rota (Index, Simulados, Prova, Resultado, Ranking, etc.).
- **`src/hooks/`** — useSimulados, useSimuladoDetail, useExamFlow (prova), useExamStorageReal, useRanking.
- **`src/services/`** — simuladosApi, rankingApi (Supabase).
- **`src/lib/`** — simulado-helpers, resultHelpers, errorNotebookReasons, utils.
- **`src/integrations/supabase/`** — client e tipos gerados.

## Segmentos de usuário

O app diferencia três segmentos (definidos no banco, tabela `profiles.segment`):

| Segmento | Acesso |
|----------|--------|
| **guest** | Simulados, ranking. Caderno de Erros e comparativo bloqueados (ProGate). |
| **standard** | Simulados, ranking, comparativo. Caderno de Erros bloqueado. |
| **pro** | Acesso completo: simulados, ranking, comparativo, Caderno de Erros. |

Quem define o valor de `segment` (manual no Supabase ou integração com outro sistema) não está no código; verifique no dashboard do Supabase ou com a equipe de produto.

## Deploy

O projeto foi criado no [Lovable](https://lovable.dev); lá você pode usar Share → Publish. Para deploy manual (Vercel, Netlify, etc.), configure as variáveis de ambiente e use o build estático (`npm run build` → pasta `dist`).

## Licença e créditos

Projeto gerado no Lovable e continuado no Cursor. Stack: Vite, React, TypeScript, shadcn-ui, Tailwind CSS, Supabase.
