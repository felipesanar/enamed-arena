

# Add subscriber type info to HubSpot sync + fix build error

## Problem
The HubSpot payload already sends the raw `segment` value (`guest`/`standard`/`pro`), but the user wants a human-readable subscriber type label so HubSpot can clearly distinguish between "Aluno PRO", "Aluno SanarFlix", and "Não assinante".

There's also a pre-existing build error in `simuladosApi.ts` line 231 (type cast issue).

## Changes

### 1. Edge Function: `hubspot-contact-sync/index.ts`
Add a `subscriber_type` field to the HubSpot payload that maps:
- `pro` → `"Aluno PRO"`
- `standard` → `"Aluno SanarFlix"`
- `guest` (or anything else) → `"Não assinante"`

Apply this mapping in both **single** and **bulk** modes.

### 2. DB Trigger: new migration
Update the `notify_hubspot_new_user()` function to also pass `segment` in the payload (it already does — no change needed here, the edge function handles the mapping).

No trigger changes needed since `segment` is already sent from the trigger. The edge function will derive `subscriber_type` from it.

### 3. Build error fix: `src/services/simuladosApi.ts` line 231
Change the cast from `as QuestionOptionRow[]` to `as unknown as QuestionOptionRow[]` to satisfy TypeScript when `is_correct` is not in the select.

## Technical Detail

**Mapping function (in edge function):**
```typescript
function subscriberType(segment?: string): string {
  if (segment === "pro") return "Aluno PRO";
  if (segment === "standard") return "Aluno SanarFlix";
  return "Não assinante";
}
```

**Payload addition:**
```typescript
subscriber_type: subscriberType(user.segment),
```

This adds `subscriber_type` alongside the existing `segment` field so HubSpot workflows can use either.

