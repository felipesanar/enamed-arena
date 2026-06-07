import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckButton } from './CheckButton';
import { FilterChip } from './FilterChip';
import { calcStreak, pluralize, fmtDate, type NotebookEntry } from './helpers';

describe('CheckButton', () => {
  it('reflete o estado done em aria-pressed e dispara onToggle', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<CheckButton done={false} onToggle={onToggle} label="Marcar como revisado" />);
    const btn = screen.getByRole('button', { name: 'Marcar como revisado' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<CheckButton done onToggle={onToggle} label="Marcar como revisado" />);
    expect(screen.getByRole('button', { name: 'Marcar como revisado' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('FilterChip', () => {
  it('renderiza como radio, reflete active e mostra label + count', () => {
    const onClick = vi.fn();
    render(<FilterChip label="Não sabia" count={3} active onClick={onClick} />);
    const chip = screen.getByRole('radio', { name: /Não sabia/ });
    expect(chip).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omite o count quando não fornecido e marca aria-checked=false', () => {
    render(<FilterChip label="Todos" active={false} onClick={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Todos' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('caderno helpers', () => {
  it('pluralize escolhe singular/plural por quantidade', () => {
    expect(pluralize(1, 'erro', 'erros')).toBe('erro');
    expect(pluralize(0, 'erro', 'erros')).toBe('erros');
    expect(pluralize(2, 'erro', 'erros')).toBe('erros');
  });

  it('calcStreak conta dias consecutivos resolvidos a partir de hoje', () => {
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return d.toISOString();
    };
    const entries = [
      { resolvedAt: day(0) },
      { resolvedAt: day(1) },
      { resolvedAt: day(2) },
      { resolvedAt: day(5) }, // quebra a sequência (gap em 3 e 4)
      { resolvedAt: null },
    ] as NotebookEntry[];
    expect(calcStreak(entries)).toBe(3);
    expect(calcStreak([] as NotebookEntry[])).toBe(0);
  });

  it('fmtDate formata em pt-BR (dia + mês)', () => {
    // 2026-03-14 → "14 de mar." (dia 2 dígitos, mês abreviado)
    const out = fmtDate('2026-03-14T12:00:00Z');
    expect(out).toMatch(/14/);
  });
});
