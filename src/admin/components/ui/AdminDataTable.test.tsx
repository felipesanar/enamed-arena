import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminDataTable } from './AdminDataTable';

describe('AdminDataTable sorting', () => {
  it('chama onSort ao clicar em header sortable e não em não-sortable', () => {
    const onSort = vi.fn();
    render(
      <AdminDataTable
        columns={[
          { key: 'nome', label: 'Nome', sortable: true },
          { key: 'x', label: 'X' },
        ]}
        data={[{ nome: 'a', x: '1' }]}
        sortKey="nome"
        sortDir="asc"
        onSort={onSort}
      />,
    );
    fireEvent.click(screen.getByText('Nome'));
    expect(onSort).toHaveBeenCalledWith('nome');
    fireEvent.click(screen.getByText('X'));
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('renderiza sem onSort (retrocompatível)', () => {
    render(
      <AdminDataTable
        columns={[{ key: 'nome', label: 'Nome' }]}
        data={[{ nome: 'a' }]}
      />,
    );
    expect(screen.getByText('Nome')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
  });
});
