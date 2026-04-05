# Instrumentation Guide — Como adicionar um evento de analytics

> Este guia usa exemplos reais extraídos do codebase.
> Siga exatamente este padrão para manter consistência.

---

## 1. O sistema de analytics

O sistema usa um padrão de handler plugável definido em `src/lib/analytics.ts`:

```ts
// src/lib/analytics.ts (existente)

export type AnalyticsEventName =
  | "lead_captured"
  | "onboarding_completed"
  | "simulado_started"
  // ... (adicione aqui ao criar novos eventos)

export function trackEvent(name: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  // dispara para todos os handlers registrados
}

export function registerAnalyticsHandler(handler: AnalyticsHandler) {
  handlers.push(handler);
}
```

**Fluxo:** `trackEvent()` → handlers registrados → provider externo (Posthog / Amplitude / etc.)

---

## 2. Passo a passo para adicionar um novo evento

### Passo 1 — Adicione o nome ao union type em `analytics.ts`

```ts
// src/lib/analytics.ts — ANTES
export type AnalyticsEventName =
  | "lead_captured"
  | "onboarding_completed"
  | "simulado_started"
  | "simulado_completed"
  | "correction_viewed"
  | "ranking_viewed"
  | "ranking_engagement_time"
  | "upsell_clicked";

// DEPOIS (adicionando resultado_viewed)
export type AnalyticsEventName =
  | "lead_captured"
  | "onboarding_completed"
  | "simulado_started"
  | "simulado_completed"
  | "correction_viewed"
  | "ranking_viewed"
  | "ranking_engagement_time"
  | "upsell_clicked"
  | "resultado_viewed";   // ← novo
```

### Passo 2 — Adicione a constante em `docs/analytics/tracking-plan.ts`

```ts
// docs/analytics/tracking-plan.ts
export const EVENTS = {
  // ... existing events ...
  RESULTADO_VIEWED: "resultado_viewed",   // ← novo
} as const;
```

### Passo 3 — Adicione o tipo de payload em `PayloadMap`

```ts
// docs/analytics/tracking-plan.ts
export interface PayloadMap {
  // ... existing types ...
  resultado_viewed: {
    simulado_id: string;
    score_percentage: number;
    total_correct: number;
    total_questions: number;
    worst_area: string;
    segment: "guest" | "standard" | "pro";
  };
}
```

### Passo 4 — Chame `trackEvent()` no lugar certo

```ts
// src/pages/ResultadoPage.tsx — EXEMPLO REAL

import { trackEvent } from "@/lib/analytics";
import { useUser } from "@/contexts/UserContext";

export default function ResultadoPage() {
  const { profile } = useUser();
  const { examState, loading } = useExamResult(simuladoId);

  // Disparar quando dados estiverem carregados
  useEffect(() => {
    if (loading || !examState || examState.status !== 'submitted') return;

    const breakdown = computePerformanceBreakdown(examState, questions);
    const worstArea = breakdown.byArea.at(-1)?.area ?? "unknown";
    const bestArea = breakdown.byArea[0]?.area ?? "unknown";

    trackEvent("resultado_viewed", {
      simulado_id: simuladoId,
      score_percentage: examState.score_percentage ?? 0,
      total_correct: examState.total_correct ?? 0,
      total_questions: questions.length,
      worst_area: worstArea,
      best_area: bestArea,
      segment: profile?.segment ?? "guest",
    });
  }, [loading, examState, simuladoId]);
```

---

## 3. Regras que nunca devem ser quebradas

### ✅ Use snake_case em todos os nomes de propriedades

```ts
// ❌ ERRADO (camelCase — padrão inconsistente)
trackEvent("simulado_completed", { simuladoId, answeredCount });

// ✅ CORRETO (snake_case — padrão do catalog)
trackEvent("simulado_completed", { simulado_id, answered_count });
```

### ✅ Nunca inclua PII

```ts
// ❌ ERRADO
trackEvent("onboarding_completed", { email: user.email, name: profile.name });

// ✅ CORRETO (apenas IDs e categorias genéricas)
trackEvent("onboarding_completed", {
  segment: profile.segment,
  specialty: onboarding.specialty,       // é categoria médica, não nome
  institutions_count: insts.length,      // quantidade, não nomes
});
```

### ✅ IDs sempre como string

```ts
// ❌ ERRADO
trackEvent("simulado_started", { simuladoId: 42 });

// ✅ CORRETO
trackEvent("simulado_started", { simulado_id: String(simuladoId) });
```

### ✅ Dispare no client, não no server (exceto eventos P0 de sistema)

```ts
// ✅ Para ações do usuário: sempre client
// src/hooks/useExamFlow.ts
trackEvent("simulado_completed", { ... });

// ⚠️ Para eventos de sistema (falha de storage): client também, mas no catch
// src/hooks/useExamStorageReal.ts
} catch (error) {
  trackEvent("exam_storage_fallback", {
    simulado_id: simuladoId,
    error_message: error instanceof Error ? error.message : "unknown",
    fallback_source: "localStorage",
  });
}
```

### ✅ Em useEffect, use dependências corretas para não disparar múltiplas vezes

```ts
// ❌ ERRADO — dispara em todo re-render
useEffect(() => {
  trackEvent("resultado_viewed", { ... });
});

// ❌ ERRADO — pode disparar antes dos dados carregarem
useEffect(() => {
  trackEvent("resultado_viewed", { ... });
}, []);

// ✅ CORRETO — dispara uma vez quando dados chegam
const [tracked, setTracked] = useState(false);
useEffect(() => {
  if (loading || tracked || !examState) return;
  trackEvent("resultado_viewed", { ... });
  setTracked(true);
}, [loading, examState, tracked]);
```

---

## 4. Exemplos reais do codebase

### Evento simples em um clique (existente)

```ts
// src/components/landing/LandingHero.tsx:366
<Link
  to="/login"
  onClick={() => trackEvent("lead_captured", { source: "landing_hero_primary" })}
>
  Entrar no próximo simulado
</Link>
```

### Evento com payload rico em hook (existente)

```ts
// src/hooks/useExamFlow.ts:218
trackEvent('simulado_completed', {
  simuladoId: state.simuladoId,
  answered: Object.values(state.answers).filter(a => a.selectedOption !== null).length,
  total: totalQuestions,
});
```

### Evento com tempo de engajamento (existente)

```ts
// src/pages/RankingPage.tsx:108-119
const startTime = useRef(Date.now());

useEffect(() => {
  trackEvent('ranking_viewed', { selectedSimuladoId, comparisonFilter, segmentFilter });

  return () => {
    const seconds = Math.round((Date.now() - startTime.current) / 1000);
    trackEvent('ranking_engagement_time', { seconds });
  };
}, [selectedSimuladoId]);
```

### Evento com acesso a segmento do usuário (existente)

```ts
// src/pages/CorrecaoPage.tsx:70
const { profile } = useUser();

useEffect(() => {
  if (!simuladoId) return;
  trackEvent('correction_viewed', {
    simuladoId,
    simuladoTitle: simulado?.title ?? 'unknown',
    segment: profile?.segment ?? 'guest',
  });
}, [simuladoId]);
```

### Evento de upsell com feature gate (existente)

```ts
// src/components/ProGate.tsx:79
<Button
  onClick={() => {
    trackEvent('upsell_clicked', {
      source: 'pro_gate',
      feature,
      currentSegment: profile?.segment,
      requiredSegment,
      ctaTo,
    });
    navigate(ctaTo);
  }}
>
  Fazer upgrade
</Button>
```

---

## 5. Registrar um provider de analytics

**Único lugar:** `src/main.tsx` (ou num módulo de inicialização importado nele)

```ts
// src/main.tsx — ADICIONAR antes do createRoot()
import { registerAnalyticsHandler } from "@/lib/analytics";
// import posthog from "posthog-js";  // exemplo

if (import.meta.env.VITE_POSTHOG_KEY) {
  // posthog.init(import.meta.env.VITE_POSTHOG_KEY, { api_host: "..." });

  registerAnalyticsHandler((event) => {
    // posthog.capture(event.name, {
    //   ...getSuperProperties(),
    //   ...event.payload,
    // });
  });
}
```

**Regra:** Nunca registrar handlers dentro de componentes React — eles seriam registrados múltiplas vezes em cada mount.

---

## 6. Checklist antes de fazer PR com novo evento

- [ ] Nome do evento em snake_case, padrão `objeto_verbo`
- [ ] Nome adicionado ao union type `AnalyticsEventName` em `src/lib/analytics.ts`
- [ ] Constante adicionada a `EVENTS` em `docs/analytics/tracking-plan.ts`
- [ ] Tipo de payload adicionado a `PayloadMap`
- [ ] Evento documentado em `docs/analytics/event-catalog.md`
- [ ] Sem PII no payload (sem email, nome, número de telefone)
- [ ] IDs como string
- [ ] Propriedades em snake_case
- [ ] `side` correto: não duplicar eventos client + server para a mesma ação
- [ ] useEffect com dependências corretas (sem disparo múltiplo)
- [ ] `gaps.md` atualizado se o evento resolve um gap documentado
