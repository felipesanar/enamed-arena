import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FloatingProfSan } from './FloatingProfSan';

const KEY = 'profsan:test:open';

function renderWidget() {
  return render(
    <FloatingProfSan storageKey={KEY}>
      <p>conteúdo</p>
    </FloatingProfSan>,
  );
}

describe('FloatingProfSan — abertura por sessão', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('abre automaticamente na primeira carga da sessão', () => {
    renderWidget();
    // Painel aberto expõe o botão "Recolher"; o FAB fechado exporia "Abrir".
    expect(screen.getByLabelText('Recolher Prof. San')).toBeInTheDocument();
    expect(screen.queryByLabelText('Abrir Prof. San')).not.toBeInTheDocument();
  });

  it('respeita o colapso manual nas cargas seguintes da mesma sessão', async () => {
    const first = renderWidget();
    fireEvent.click(screen.getByLabelText('Recolher Prof. San'));
    await waitFor(() => expect(screen.getByLabelText('Abrir Prof. San')).toBeInTheDocument());
    first.unmount();

    // Re-navegação dentro da mesma sessão (sessionStorage preservado).
    renderWidget();
    await waitFor(() => expect(screen.getByLabelText('Abrir Prof. San')).toBeInTheDocument());
    expect(screen.queryByLabelText('Recolher Prof. San')).not.toBeInTheDocument();
  });

  it('volta a abrir automaticamente em uma nova sessão', async () => {
    const first = renderWidget();
    fireEvent.click(screen.getByLabelText('Recolher Prof. San'));
    await waitFor(() => expect(screen.getByLabelText('Abrir Prof. San')).toBeInTheDocument());
    first.unmount();

    // Nova sessão do navegador.
    sessionStorage.clear();
    renderWidget();
    expect(screen.getByLabelText('Recolher Prof. San')).toBeInTheDocument();
  });
});
