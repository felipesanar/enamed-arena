import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RetaFinalHero } from '@/components/caderno/retafinal/RetaFinalHero';
const mocks = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => mocks.mobile }));
afterEach(cleanup);
describe('RetaFinalHero optional edition context', () => {
  for (const mobile of [false, true]) it(`shows target label and format without losing legacy defaults (mobile=${mobile})`, () => {
    mocks.mobile = mobile;
    const stats = { totalActive: 5, overdue: 3, mastered: 2, covered: 5, uncovered: 0, daysUntil: 10 };
    const view = render(<RetaFinalHero daysUntil={10} stats={stats} editionLabel="ENAMED 2027.2" formatLabel="120 questões · 5 alternativas" />);
    expect(screen.getByText('para o ENAMED 2027.2')).toBeInTheDocument(); expect(screen.getByText('120 questões · 5 alternativas')).toBeInTheDocument();
    view.rerender(<RetaFinalHero daysUntil={10} stats={stats} />); expect(screen.getByText('para o ENAMED')).toBeInTheDocument();
  });
  it('keeps all three mobile KPI labels on one line with compact spacing', () => {
    mocks.mobile = true;
    render(<RetaFinalHero daysUntil={10} stats={{ totalActive: 35, overdue: 35, mastered: 2, covered: 35, uncovered: 0, daysUntil: 10 }} />);
    for (const label of ['Vencidas', 'No plano', 'Dominadas']) {
      expect(screen.getByText(label)).toHaveClass('whitespace-nowrap', 'tracking-[0.02em]');
      expect(screen.getByText(label).parentElement).toHaveClass('px-1.5');
    }
  });
});
