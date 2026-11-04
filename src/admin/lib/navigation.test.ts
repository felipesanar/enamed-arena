import { describe, expect, it } from 'vitest';
import { visibleNav } from './navigation';
describe('versioned bank navigation gate', () => {
  const hasBank = (capabilities: string[], flag: boolean) => visibleNav(new Set(capabilities),flag).flatMap(group => group.items).some(item => item.to === '/admin/banco-questoes');
  it('shows the bank only when the feature and content permission are both present', () => {
    expect(hasBank(['content.manage'],true)).toBe(true);
    expect(hasBank(['intel.view'],true)).toBe(false);
    expect(hasBank(['content.manage'],false)).toBe(false);
  });
});
