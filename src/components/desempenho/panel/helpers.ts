export type Tier = 'success' | 'warning' | 'destructive';

export function scoreTier(score: number): Tier {
  if (score >= 70) return 'success';
  if (score >= 50) return 'warning';
  return 'destructive';
}
