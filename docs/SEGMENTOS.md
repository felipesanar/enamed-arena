# Segmentos de usuário (guest / standard / pro)

## Onde está no código

- **Tipos:** `src/types/index.ts` — `UserSegment`, `SEGMENT_ACCESS`, `SEGMENT_LABELS`, `SEGMENT_DESCRIPTIONS`.
- **Leitura:** `UserContext` carrega `profile.segment` da tabela Supabase `profiles`.
- **Uso:** `useSegment()`, `useHasAccess(feature)`; componente `ProGate` para bloquear UI por segmento; `AppSidebar` e `AppLayout` exibem o segmento atual.

## Tabela de acesso por feature

| Feature        | guest | standard | pro |
|----------------|-------|----------|-----|
| Simulados      | ✅    | ✅       | ✅  |
| Ranking        | ✅    | ✅       | ✅  |
| Comparativo    | ❌    | ✅       | ✅  |
| Caderno de Erros | ❌  | ❌       | ✅  |

Constante em código: `SEGMENT_ACCESS` em `src/types/index.ts`.

## Quem define o segmento

O valor de `profiles.segment` é **gravado no Supabase**. O front-end apenas lê. Possíveis origens:

- Atualização manual no dashboard Supabase.
- Trigger ou job no banco ao criar/atualizar perfil.
- Integração com outro sistema (ex.: assinatura SanarFlix/PRO) que atualize a tabela `profiles`.

Para saber como o segmento é atribuído no seu ambiente, consulte a equipe de backend ou as políticas/triggers do projeto Supabase.
