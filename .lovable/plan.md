

# Correção: Logo no PDF + Timer/Progresso do Modo Offline

## Problema 1 — Logo no PDF

O header do PDF usa um ícone genérico de 40x40px (`LOGO_ICON_B64`) que não corresponde à logo real. O usuário quer a logo completa "SanarFlix PRO · SIMULADOS" (o SVG enviado) renderizada no header do PDF.

**Solução:** Converter o SVG da logo para PNG branco (para fundo wine), gerar em alta resolução (~400x110px), embarcar como base64 no Edge Function e substituir o ícone + texto "SanarFlix PRO" / "ENAMED" por uma única imagem da logo completa.

### Etapas
- Gerar PNG branco da logo SVG usando script Node/canvas
- Embarcar o base64 resultante no `generate-exam-pdf/index.ts`
- Substituir no `drawHeader`: remover `drawText("SanarFlix PRO")` e `drawText("ENAMED")`, usar `drawImage(logoFull)` com dimensões proporcionais

## Problema 2 — Timer não aparece + navegação prematura ao gabarito

**Causa raiz identificada:** Race condition no `useOfflineAttempt`:
1. `persistOfflineAttempt()` é chamado na linha 217, ANTES do PDF ser baixado
2. O StorageEvent dispara, `localAttempt` atualiza, `activeAttempt` fica não-nulo
3. MAS `remaining` ainda é 0 (valor inicial) porque o `useEffect` do countdown ainda não re-executou
4. `isExpired = !!activeAttempt && remaining === 0` → **true** por um instante
5. `FloatingOfflineTimer` detecta `isExpired` e auto-navega para `/gabarito`, fechando o modal de progresso

O timer só aparece após F5 porque nesse ponto o `calcRemaining` já computa corretamente.

**Solução:**
1. **Eliminar a race condition** — Quando `activeAttempt` muda, recalcular `remaining` **sincronamente** no mesmo render, não num `useEffect` assíncrono
2. **Mover `persistOfflineAttempt` para DEPOIS do download** — Só persistir a tentativa no localStorage após o PDF ser efetivamente baixado, garantindo que o usuário veja todo o progresso
3. **Adicionar guard no FloatingOfflineTimer** — Não auto-navegar se o attempt acabou de ser criado (< 30s)

### Alterações

**`src/hooks/useOfflineAttempt.ts`**
- Substituir o `useState` + `useEffect` do countdown por `useMemo` + `useEffect` que **inicializa sincronamente** via `calcRemaining(activeAttempt?.effective_deadline)` no mesmo ciclo de render
- Garantir que `remaining` nunca fique em 0 quando `effective_deadline` é futuro

**`src/pages/SimuladosPage.tsx`**
- Mover `persistOfflineAttempt()` para DEPOIS da linha 237 (após `URL.revokeObjectURL`), para que o timer só apareça quando o PDF já foi baixado com sucesso
- O usuário verá todo o progresso ("Criando tentativa...", "Gerando PDF...", "Baixando PDF...") sem interrupção

**`src/components/FloatingOfflineTimer.tsx`**
- Adicionar guard: se `remaining > 0` mas `activeAttempt.started_at` foi há menos de 30 segundos, não tratar como expirado

**`supabase/functions/generate-exam-pdf/index.ts`**
- Substituir `LOGO_ICON_B64` pelo logo completo em PNG branco
- No `drawHeader`, remover as duas chamadas `drawText` ("SanarFlix PRO" e "ENAMED") e usar uma única `drawImage` da logo completa

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/generate-exam-pdf/index.ts` | Logo completa no header |
| `src/hooks/useOfflineAttempt.ts` | Fix race condition no countdown |
| `src/pages/SimuladosPage.tsx` | Mover persist para depois do download |
| `src/components/FloatingOfflineTimer.tsx` | Guard contra navegação prematura |

