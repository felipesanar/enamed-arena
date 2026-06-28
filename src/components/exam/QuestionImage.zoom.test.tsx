import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QuestionImage } from './QuestionImage';

describe('QuestionImage zoom lightbox', () => {
  it('opens lightbox and zooms in/out', () => {
    render(<QuestionImage src="data:image/png;base64,AAAA" alt="teste" />);
    fireEvent.click(screen.getAllByRole('button')[0]); // thumbnail
    const zoomIn = screen.getByLabelText('Aumentar zoom');
    const zoomOut = screen.getByLabelText('Diminuir zoom');
    expect(zoomOut).toBeDisabled();
    fireEvent.click(zoomIn);
    expect(screen.getByText(/%$/)).toBeTruthy();
    expect(zoomOut).not.toBeDisabled();
    expect(screen.getByLabelText('Resetar zoom')).toBeTruthy();
    expect(screen.getByLabelText('Fechar imagem')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Resetar zoom'));
    expect(zoomOut).toBeDisabled();
  });
});
