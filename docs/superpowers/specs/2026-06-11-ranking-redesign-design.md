# Ranking — Paridade de dados (nota de corte) + Redesign UX/UI

**Data:** 2026-06-11
**Status:** Aprovado para planejamento

## Problema

1. **Nota de corte quase nunca aparece.** O match entre a instituição do usuário
   e a tabela `enamed_cutoff_scores` é feito por nome de texto com
   `LIKE '%nome%'` normalizado (`match_cutoff_score`). Medido em produção:
   apenas **37 de 197 instituições selecionáveis (19%)** conseguem match. 114
   dos 143 nomes da tabela de corte não batem com `enamed_institutions` — são
   grafias diferentes das mesmas instituições. Fuzzy matching em runtime não
   resolve (só 9 de 110 têm candidato por contenção de texto): exige curadoria.
2. **"Ainda não sei" é salvo como string literal** em
   `onboarding_profiles.specialty` (508 usuários) e em
   `target_institutions` (1.575 seleções). Esses usuários não têm pill de
   especialidade, filtro nem nota de corte — falha silenciosa.
3. **Tudo é amarrado por string de nome**, não por ID. Renomear uma instituição
   em `enamed_institutions` quebra perfis salvos e o match de corte sem aviso.
4. **UI do ranking fora do design system.** `RankingView.tsx` carrega ~90
   tokens de cor inline + `MutationObserver` próprio de dark mode; a nota de
   corte considera só a 1ª instituição-alvo do usuário.

## Decisões (com o produto)

| Decisão | Escolha |
|---|---|
| Modelo de dados | Canônico por ID (FKs), strings mantidas como colunas derivadas |
| "Ainda não sei" | Continua selecionável; salvo como `NULL`; CTA no ranking |
| Modelo de filtros do ranking | Mantém o atual (Todos / minha especialidade / + minha 1ª instituição, Segmento) — só polimento visual |
| Nota de corte | Calculada e exibida para **todas** as instituições-alvo do usuário |
| Direção visual | **B — "Aprovação em foco"**: régua "sua nota vs. cortes" lidera a página |

## 1. Camada de dados (Supabase)

### Schema (migrations aditivas)

- `onboarding_profiles`:
  - `+ specialty_id uuid NULL REFERENCES enamed_specialties(id)`
  - `+ target_institution_ids uuid[] NULL` (elementos referenciam `enamed_institutions.id`; validação no RPC)
  - `specialty text` e `target_institutions text[]` permanecem como colunas
    derivadas dos IDs (sincronizadas pelo RPC) para compatibilidade durante a
    transição.
- `enamed_cutoff_scores`:
  - `+ institution_id uuid NULL REFERENCES enamed_institutions(id)`
  - `+ specialty_id uuid NULL REFERENCES enamed_specialties(id)`

### Backfill

- `enamed_cutoff_scores.specialty_id`: match exato por nome normalizado
  (validado: 100% das especialidades do corte existem em `enamed_specialties`).
- `enamed_cutoff_scores.institution_id`: **de-para curado**. Claude gera a
  proposta de mapeamento (cutoff_name → enamed_institutions.id) para os ~110
  nomes divergentes, em arquivo revisável
  (`docs/superpowers/specs/2026-06-11-cutoff-de-para.csv`, colunas:
  `cutoff_institution_name, matched_institution_id, matched_institution_name,
  confianca, observacao`); Felipe revisa e aprova antes da migration de
  backfill. Nomes sem
  correspondência real ficam com `institution_id = NULL` (não selecionáveis
  pelo usuário ⇒ sem impacto em paridade).
- `onboarding_profiles`: nomes → IDs por match exato;
  `"Ainda não sei"` → `NULL` (specialty) e removido do array de instituições.
  Texto derivado re-sincronizado.

### RPCs

- `save_onboarding_guarded(p_specialty_id uuid, p_target_institution_ids uuid[])`
  — nova sobrecarga: valida IDs contra as tabelas `enamed_*` (NULL permitido
  para "ainda não sei"), mantém as regras atuais (guest ≥ 3 instituições,
  bloqueio durante janela aberta), grava IDs **e** textos derivados. A
  assinatura antiga (text) permanece até o cutover do frontend ser deployado.
- `get_cutoff_scores(p_specialty_id uuid, p_institution_ids uuid[])` — novo:
  join exato por ID, retorna uma linha por instituição-alvo
  (`institution_id, institution_name, cutoff_score_general, cutoff_score_quota,
  practice_scenario`). Substitui `match_cutoff_score` (que é removido após o
  cutover).
- `get_ranking_for_simulado` — passa a derivar `especialidade` /
  `instituicoes_alvo` via join pelos IDs quando presentes (fallback para os
  campos texto p/ perfis antigos não migrados). Contrato de retorno inalterado.

### Critério de aceite (dados)

- Baseline medido hoje: 19% das instituições selecionáveis com match de corte.
- Meta pós-de-para: toda instituição selecionável tem **ou** corte por join de
  ID **ou** estado explícito "corte indisponível" (sem falha silenciosa).
- Zero strings `"Ainda não sei"` remanescentes em `onboarding_profiles`.

## 2. Serviços e contexto (frontend)

- `UserContext`: `onboarding` ganha `specialtyId: string | null` e
  `targetInstitutionIds: string[]`; `saveOnboarding` envia IDs pela nova
  sobrecarga do RPC.
- `OnboardingPage` / `SpecialtyStep` / `InstitutionStep` /
  `AcademicProfileEditor`: mesma UX, seleção passa a operar por ID; a opção
  "Ainda não sei" mapeia para `null` (remove a string mágica triplicada).
- `rankingApi`: `fetchCutoffScores(specialtyId, institutionIds): CutoffScoreRow[]`
  substitui `fetchCutoffScore`; novo hook `useCutoffScores`.

## 3. UI do ranking (Direção B — "Aprovação em foco")

Anatomia da página (`RankingView`), de cima para baixo:

1. **Seletor de simulado** — chips, comportamento atual, repolido.
2. **Painel "Você passaria?"** (novo, protagonista —
   `RankingApprovalPanel`):
   - Régua horizontal 0–100 com marcador da nota do usuário e marcadores de
     corte por instituição-alvo (success = alcançada, destructive = falta X pts).
   - Lista compacta por instituição: nome, corte geral, corte cotas (se houver),
     gap/status.
   - Estados: `sem_perfil` (CTA "Complete seu perfil" → /configuracoes),
     `sem_corte` por instituição (badge "corte indisponível"), `loading`
     (skeleton), mensagens de incentivo no estado fail (mantidas do atual).
3. **Stats row** — Posição (#N de M), Percentil, Vs. média — metric cards do
   design system.
4. **Filtros** (`RankingFilterBar`) — mesmo comportamento; rebuild com tokens
   semânticos.
5. **Tabela** (`RankingTable`) — top 10 + vizinhança ±2 + separador (lógica
   `buildTableRows` mantida), barra sticky da posição do usuário, rebuild
   visual.

### Refatoração técnica

- Eliminar o objeto `t` (~90 tokens inline) e o `MutationObserver` de dark mode
  em `RankingView` → Tailwind com tokens semânticos + `dark:` variants.
- Hero/painéis wine permanecem always-dark conforme padrão do projeto.
- `CutoffScoreModal` atualizado para visão multi-instituição (tabela completa
  de cortes da especialidade continua acessível).
- `RankingHeroStats` é substituído pelo conjunto ApprovalPanel + StatsRow.
- Admin preview (`participantDisplay='admin'`) continua suportado por
  `RankingView` sem mudança de contrato.

### Mobile

- Régua mantém orientação horizontal; labels de corte alternam acima/abaixo
  para evitar colisão; lista por instituição vira o detalhamento principal.
- Stats row: 3 colunas → empilhado.

## 4. Edge cases

- Especialidade NULL: sem pill de especialidade; painel mostra CTA de perfil.
- Instituição-alvo sem linha de corte: exibida com "corte indisponível".
- Recorte com < 30 participantes: banner de baixa confiança mantido.
- Attempts fora da janela (treino): continuam fora do ranking (sem mudança).
- Perfis antigos não migrados (edge residual): fallback por texto no
  `get_ranking_for_simulado`.

## 5. Testes

- Unit (Vitest): derivação de estados do painel (`pass`/`fail`/`indisponível`/
  `sem_perfil`), mapeamento "Ainda não sei" → null, transform de
  `fetchCutoffScores`, `buildTableRows` (existente, mantido).
- Migração: queries de verificação antes/depois do backfill (contagens de
  match; baseline 19%).
- Atualização dos testes existentes do ranking afetados pelo rebuild.

## Sequência de entrega

1. Migrations de schema (aditivas) + geração do de-para → **revisão do de-para
   pelo Felipe** → migration de backfill.
2. RPCs novos (`get_cutoff_scores`, sobrecarga de `save_onboarding_guarded`,
   ajuste do `get_ranking_for_simulado`).
3. Frontend: contexto/serviços por ID + onboarding/editor.
4. Frontend: redesign do ranking (Direção B) + refactor de tokens.
5. Cleanup: remoção do RPC antigo `match_cutoff_score` e da sobrecarga text
   após cutover estável.
