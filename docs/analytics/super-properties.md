# Super-Propriedades — SanarFlix PRO: ENAMED

> Super-propriedades são enviadas automaticamente em **todos** os eventos.
> Devem ser injetadas pelo handler de analytics registrado via `registerAnalyticsHandler()`.

---

## Propriedades Obrigatórias (todos os eventos)

| Propriedade | Tipo | Fonte no Código | Notas |
|---|---|---|---|
| `user_id` | `string \| null` | `AuthContext.user?.id` | `null` para usuários não autenticados (landing) |
| `session_id` | `string` | Gerado uma vez por sessão de browser (sessionStorage) | UUID v4; nunca inclui PII |
| `app_version` | `string` | `import.meta.env.VITE_APP_VERSION` ou git SHA | Permite isolar regressions por deploy |
| `platform` | `"web"` | Constante | Preparação para mobile nativo futuro |
| `timestamp_ms` | `number` | `Date.now()` | Unix ms; complementa o `timestamp` ISO já existente em `AnalyticsEvent` |

---

## Propriedades de Contexto do Usuário (quando autenticado)

| Propriedade | Tipo | Fonte no Código | Notas |
|---|---|---|---|
| `user_segment` | `"guest" \| "standard" \| "pro"` | `UserContext.profile?.segment` | Crítico para segmentação de funil |
| `onboarding_complete` | `boolean` | `UserContext.isOnboardingComplete` | Distingue novos usuários sem perfil |
| `user_specialty` | `string \| null` | `UserContext.onboarding?.specialty` | Nunca logar como PII — é categoria médica genérica |
| `user_institutions_count` | `number \| null` | `UserContext.onboarding?.targetInstitutions?.length` | Quantidade, não nomes |

---

## Propriedades de Contexto de Exame (apenas durante `SimuladoExamPage`)

Estas propriedades devem ser injetadas somente quando o usuário está em `/simulados/:id/prova`.

| Propriedade | Tipo | Fonte no Código | Notas |
|---|---|---|---|
| `active_simulado_id` | `string` | Route param `:id` | ID do simulado ativo |
| `active_attempt_id` | `string` | `useExamFlow.state.attemptId` (quando disponível) | Para correlacionar eventos intra-sessão de prova |

---

## Notas de Implementação

### Como injetar super-propriedades

O sistema de analytics atual (`src/lib/analytics.ts`) usa um padrão de handler plugável:

```ts
// Em src/lib/analytics.ts (existente)
registerAnalyticsHandler((event) => {
  // Enriquecer event.payload com super-propriedades antes de enviar
  const enriched = {
    ...getSuperProperties(),   // função a criar
    ...event.payload,          // payload do evento sobrescreve se houver conflito
  };
  // enviar para Posthog / Amplitude / etc.
  posthog.capture(event.name, enriched);
});
```

### Onde criar `getSuperProperties()`

Criar em `src/lib/analytics.ts` ou em um novo `src/lib/analyticsContext.ts`:

```ts
import { supabase } from "@/integrations/supabase/client";

function getSessionId(): string {
  const key = "_ea_sid";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

export function getSuperProperties() {
  const { data: { user } } = await supabase.auth.getSession();
  return {
    user_id: user?.id ?? null,
    session_id: getSessionId(),
    app_version: import.meta.env.VITE_APP_VERSION ?? "unknown",
    platform: "web" as const,
    timestamp_ms: Date.now(),
  };
}
```

### PII: o que NÃO incluir nas super-propriedades

- `user.email` — é PII
- `user.user_metadata.full_name` — é PII
- `onboarding.targetInstitutions` como array — são nomes de IES, não logar diretamente
- `profile.avatarUrl` — é PII

### Quando `user_segment` pode estar `undefined`

Nas primeiras interações (landing page), `UserContext` ainda está `loading`.
O handler deve tolerar `undefined` e usar `"unauthenticated"` como fallback:

```ts
const segment = userSegment ?? (authUser ? "loading" : "unauthenticated");
```
