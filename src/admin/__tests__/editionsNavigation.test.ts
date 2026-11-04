import { describe, expect, it } from 'vitest';
import { visibleNav } from '@/admin/lib/navigation';
import { getAvailableCommands } from '@/admin/lib/commandRegistry';

describe('editions navigation', () => {
  const content = new Set(['content.manage']);
  it('fails closed without the flag, including commands', () => {
    expect(visibleNav(content).flatMap(g => g.items).some(i => i.to === '/admin/edicoes')).toBe(false);
    expect(getAvailableCommands(content).some(i => i.route === '/admin/edicoes')).toBe(false);
  });
  it('requires capability and flag together', () => {
    expect(visibleNav(content, true).flatMap(g => g.items).some(i => i.to === '/admin/edicoes')).toBe(true);
    expect(getAvailableCommands(content, true).some(i => i.route === '/admin/edicoes')).toBe(true);
    expect(visibleNav(new Set(), true).flatMap(g => g.items)).toEqual([]);
    expect(getAvailableCommands(new Set(), true).some(i => i.route === '/admin/edicoes')).toBe(false);
  });
});
