

# Fix: DesempenhoPage not showing data for offline attempts

## Root Cause

`useExamResult.ts` line 69 hardcodes `attempt_type = 'online'`:

```typescript
const attempt = await simuladosApi.getAttempt(config.id, user.id, 'online');
```

For users who completed the exam in offline mode (like this student), `getAttempt` returns `null` → no exam state → no breakdown → empty performance page. This affects **all offline-only students**.

## Fix

### File: `src/hooks/useExamResult.ts` (line 69)

Fetch both online and offline attempts, then pick the most relevant one using the existing `pickMostRelevantAttempt` helper (already used in `useSimulados`):

```typescript
import { pickMostRelevantAttempt } from '@/lib/attempt-helpers';

// Replace line 69:
const attempt = await simuladosApi.getAttempt(config.id, user.id, 'online');

// With:
const [onlineAttempt, offlineAttempt] = await Promise.all([
  simuladosApi.getAttempt(config.id, user.id, 'online'),
  simuladosApi.getAttempt(config.id, user.id, 'offline'),
]);
const attempt = pickMostRelevantAttempt(onlineAttempt, offlineAttempt) ?? null;
```

This ensures the hook finds the best completed attempt regardless of mode, using the same priority logic already established in the codebase (finished attempts win over in-progress; most recent wins ties).

## Impact

- Fixes performance page for all offline-only students
- No changes to the API layer or database
- Single file edit, ~5 lines changed

