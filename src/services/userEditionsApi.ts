import { supabase } from '@/integrations/supabase/client';
import type { OnboardingProfile } from '@/types';

type Target = Pick<OnboardingProfile, 'targetEditionId' | 'expectedGraduationTerm'>;
type TargetRow = { target_edition_id: string | null; expected_graduation_term: string | null };

// Narrow expand-phase boundary; remove after generating the real database types.
const client = supabase as unknown as {
  rpc(name: 'set_target_edition_guarded', args: {
    p_edition_id: string | null; p_expected_graduation_term: string | null;
  }): PromiseLike<{ error: unknown }>;
  from(table: 'onboarding_profiles'): {
    select(columns: 'target_edition_id,expected_graduation_term'): {
      eq(column: 'user_id', id: string): {
        maybeSingle(): PromiseLike<{ data: TargetRow | null; error: unknown }>;
      };
    };
  };
};

export const userEditionsApi = {
  async setTargetEdition(editionId: string | null, expectedGraduationTerm: string | null): Promise<void> {
    const { error } = await client.rpc('set_target_edition_guarded', {
      p_edition_id: editionId, p_expected_graduation_term: expectedGraduationTerm,
    });
    if (error) throw error;
  },
  async getTarget(userId: string): Promise<Target> {
    const { data, error } = await client.from('onboarding_profiles')
      .select('target_edition_id,expected_graduation_term').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return { targetEditionId: data?.target_edition_id ?? null,
      expectedGraduationTerm: data?.expected_graduation_term ?? null };
  },
};
