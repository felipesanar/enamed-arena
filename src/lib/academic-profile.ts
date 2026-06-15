/** Rótulo de exibição para perfil sem especialidade definida. */
export const UNDECIDED_LABEL = 'Ainda não sei';

export function displaySpecialty(
  onboarding: { specialtyId: string | null; specialty: string } | null,
): string {
  if (!onboarding || !onboarding.specialtyId) return UNDECIDED_LABEL;
  return onboarding.specialty || UNDECIDED_LABEL;
}
