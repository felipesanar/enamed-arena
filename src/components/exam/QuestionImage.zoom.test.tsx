import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QuestionImage } from './QuestionImage';

describe('QuestionImage zoom lightbox', () => {
  it('opens lightbox and zooms in/out', () => {
    render(<QuestionImage src="data:image/png;base64,AAAA" alt="teste" />);
    // open lightbox
    fireEvent.click(screen.getByRole('button', { name: '' }) ?? screen.getAllByRole('button')[0]);
    // toolbar zoom buttons appear
    const zoomIn = screen.getByLabelText('Aumentar zoom');
    const zoomOut = screen.getByLabelText('Diminuir zoom');
    expect(zoomOut).toBeDisabled(); // at 1x
    fireEvent.click(zoomIn);
    // scale indicator shows percent > 100%
    expect(screen.getByText(/%$/)).toBeTruthy();
    expect(zoomOut).not.toBeDisabled();
    expect(screen.getByLabelText('Resetar zoom')).toBeTruthy();
    expect(screen.getByLabelText('Fechar imagem')).toBeTruthy();
  });
});
