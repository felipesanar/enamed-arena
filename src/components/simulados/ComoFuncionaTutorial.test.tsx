import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ComoFuncionaSimuladosTrigger } from './ComoFuncionaTutorial';

afterEach(cleanup);

describe('Como funciona copy', () => {
  it('explains platform ranking, practice and configured release without promising the official format', async () => {
    render(<ComoFuncionaSimuladosTrigger />);
    fireEvent.click(screen.getByRole('button', { name: 'Como funciona' }));
    expect(await screen.findByText(/ranking dos participantes da plataforma/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/oficial|mesmo formato|mesma pressão/i);

    fireEvent.click(screen.getByRole('button', { name: 'Ir para etapa 2' }));
    expect(await screen.findByText(/não entra no ranking/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent(/data de liberação/i);

    fireEvent.click(screen.getByRole('button', { name: 'Ir para etapa 3' }));
    expect(await screen.findByText(/data de liberação configurada para cada simulado/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent(/edição-alvo/i);
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/após o encerramento da janela, liberamos/i);

    fireEvent.click(screen.getByRole('button', { name: 'Ir para etapa 4' }));
    expect(await screen.findByText(/cronômetro/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent(/resultado.*data de liberação/i);
    expect(screen.getByRole('dialog')).toHaveTextContent(/ranking.*data de liberação/i);
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/liberado após a janela|disponível após encerramento/i);
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
  });
});
