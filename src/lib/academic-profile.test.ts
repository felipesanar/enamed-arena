import { describe, it, expect } from 'vitest';
import { UNDECIDED_LABEL, displaySpecialty } from '@/lib/academic-profile';

describe('academic-profile helpers', () => {
  it('UNDECIDED_LABEL é o literal de exibição', () => {
    expect(UNDECIDED_LABEL).toBe('Ainda não sei');
  });

  it('displaySpecialty devolve o nome quando há especialidade', () => {
    expect(displaySpecialty({ specialtyId: 'abc', specialty: 'PEDIATRIA' })).toBe('PEDIATRIA');
  });

  it('displaySpecialty devolve o rótulo indeciso quando specialtyId é null', () => {
    expect(displaySpecialty({ specialtyId: null, specialty: '' })).toBe(UNDECIDED_LABEL);
    expect(displaySpecialty(null)).toBe(UNDECIDED_LABEL);
  });
});
