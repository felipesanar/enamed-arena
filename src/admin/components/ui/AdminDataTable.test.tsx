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

describe('AdminDataTable estados', () => {
  it('mostra a mensagem de vazio quando não há linhas', () => {
    render(
      <AdminDataTable
        columns={[{ key: 'nome', label: 'Nome' }]}
        data={[]}
      />,
    );
    expect(screen.getByText('Nada por aqui ainda.')).toBeInTheDocument();
  });

  it('aceita mensagem de vazio customizada', () => {
    render(
      <AdminDataTable
        columns={[{ key: 'nome', label: 'Nome' }]}
        data={[]}
        emptyMessage="Nenhuma pessoa cadastrada."
      />,
    );
    expect(screen.getByText('Nenhuma pessoa cadastrada.')).toBeInTheDocument();
  });

  it('no carregando mantém o cabeçalho, marca aria-busy e não mostra dados', () => {
    const { container } = render(
      <AdminDataTable
        columns={[{ key: 'nome', label: 'Nome' }]}
        data={[{ nome: 'visivel' }]}
        isLoading
      />,
    );
    // cabeçalho continua visível
    expect(screen.getByText('Nome')).toBeInTheDocument();
    // dados reais não aparecem durante o carregamento
    expect(screen.queryByText('visivel')).not.toBeInTheDocument();
    // a tabela sinaliza ocupado para leitores de tela
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('respeita o número de linhas-fantasma (loadingRows)', () => {
    const { container } = render(
      <AdminDataTable
        columns={[{ key: 'nome', label: 'Nome' }]}
        data={[]}
        isLoading
        loadingRows={3}
      />,
    );
    const rows = container.querySelectorAll('[data-skeleton-row]');
    expect(rows.length).toBe(3);
  });
});
