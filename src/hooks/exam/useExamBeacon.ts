/**
 * useExamBeacon — persistência de emergência no unload da página.
 *
 * Extraído de useExamFlow (Fase 3 / REFACTOR_ROADMAP). Mantém o access_token do
 * usuário fresco (via getSession + onAuthStateChange) e, no beforeunload, chama
 * flushPendingState e dispara um fetch keepalive para salvar respostas com o JWT
 * correto (sendBeacon não suporta headers customizados). NÃO muda comportamento.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ExamState } from '@/types/exam';

/** Subconjunto de useExamStorageReal necessário aqui. */
interface BeaconStorage {
  flushPendingState: () => void;
  attemptId: { current: string | null };
}

export interface UseExamBeaconArgs {
  storage: BeaconStorage;
  stateRef: React.MutableRefObject<ExamState | null>;
  hasFinalized: React.MutableRefObject<boolean>;
}

/**
 * Retorna o accessTokenRef para que o chamador possa inspecioná-lo em testes,
 * embora o principal efeito seja o registro do listener beforeunload.
 */
export function useExamBeacon({
  storage,
  stateRef,
  hasFinalized,
}: UseExamBeaconArgs): React.MutableRefObject<string | null> {
  // Keep the JWT access_token fresh so beforeunload can use it (it fires
  // synchronously — we can't await getSession() at that moment).
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) accessTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasFinalized.current || stateRef.current?.status !== 'in_progress') return;
      storage.flushPendingState();

      // Fire-and-forget sync as last resort. Uses the user's access_token so
      // RLS policies see auth.uid() correctly (anon key would be rejected
      // or associated with the anon role, losing the write).
      const aid = storage.attemptId.current;
      const currentState = stateRef.current;
      const accessToken = accessTokenRef.current;
      if (aid && currentState && accessToken) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (supabaseUrl && supabaseKey) {
            const rows = Object.entries(currentState.answers).map(([questionId, ans]) => ({
              attempt_id: aid,
              question_id: questionId,
              selected_option_id: ans.selectedOption,
              marked_for_review: ans.markedForReview,
              high_confidence: ans.highConfidence,
              eliminated_options: ans.eliminatedAlternatives || [],
              answered_at: ans.selectedOption ? new Date().toISOString() : null,
            }));
            if (rows.length > 0) {
              const url = `${supabaseUrl}/rest/v1/answers?on_conflict=attempt_id,question_id`;
              // fetch+keepalive so we can set Authorization with the user's JWT
              // (sendBeacon cannot set custom headers).
              fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${accessToken}`,
                  'Prefer': 'resolution=merge-duplicates',
                },
                body: JSON.stringify(rows),
                keepalive: true,
              }).catch(() => {});
            }
          }
        } catch {
          // best-effort, ignore errors
        }
      }

      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [storage, stateRef, hasFinalized]);

  return accessTokenRef;
}
