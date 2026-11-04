import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanBillboard } from './PlanBillboard';
import { SANARFLIX_PRO_ENAMED_URL } from '@/lib/sanarflix';

beforeEach(() => vi.stubGlobal('IntersectionObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('PlanBillboard copy', () => {
  it.each(['guest', 'standard', 'pro'] as const)('keeps benefits and CTA without claiming official exams for %s', segment => {
    const { container } = render(<PlanBillboard segment={segment} />);
    expect(container).not.toHaveTextContent(/simulados.*oficiais|oficiais.*ENAMED/i);
    expect(screen.getAllByRole('listitem').some(item => /Caderno de Erros/.test(item.textContent ?? ''))).toBe(true);
    const cta = screen.getByRole('link');
    expect(cta).toHaveAttribute('href', SANARFLIX_PRO_ENAMED_URL);
    expect(cta).toHaveTextContent(segment === 'pro' ? 'Abrir portal' : segment === 'guest' ? 'Conhecer o PRO' : 'Fazer upgrade');
    if (segment === 'pro') expect(screen.getByText(/simulados cronometrados.*preparação.*ENAMED/i)).toBeInTheDocument();
  });
});
