import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ExamTimerAnnouncement } from './ExamTimerAnnouncement';
afterEach(cleanup);
it('announces resume once, thresholds once and only the latest crossed threshold', () => {
  const { rerender } = render(<ExamTimerAnnouncement timeRemaining={610} />);
  const live = screen.getByRole('status');
  expect(live).toHaveTextContent('10 minutos e 10 segundos');
  rerender(<ExamTimerAnnouncement timeRemaining={609} />);
  expect(live).toHaveTextContent('10 minutos e 10 segundos');
  rerender(<ExamTimerAnnouncement timeRemaining={299} />);
  expect(live).toHaveTextContent('4 minutos e 59 segundos');
  rerender(<ExamTimerAnnouncement timeRemaining={298} />);
  expect(live).toHaveTextContent('4 minutos e 59 segundos');
  rerender(<ExamTimerAnnouncement timeRemaining={9} />);
  expect(live).toHaveTextContent('9 segundos');
  rerender(<ExamTimerAnnouncement timeRemaining={0} />);
  expect(live).toHaveTextContent('Tempo esgotado');
});
it('announces actual remaining time after skipping thresholds', () => {
  const { rerender } = render(<ExamTimerAnnouncement timeRemaining={601} />);
  rerender(<ExamTimerAnnouncement timeRemaining={79} />);
  expect(screen.getByRole('status')).toHaveTextContent('1 minuto e 19 segundos');
  rerender(<ExamTimerAnnouncement timeRemaining={78} />);
  expect(screen.getByRole('status')).toHaveTextContent('1 minuto e 19 segundos');
  rerender(<ExamTimerAnnouncement timeRemaining={-5} />);
  expect(screen.getByRole('status')).toHaveTextContent('Tempo esgotado');
});
it('does not repeat thresholds after clock corrections or repeated renders', () => {
  const { rerender } = render(<ExamTimerAnnouncement timeRemaining={61} />);
  rerender(<ExamTimerAnnouncement timeRemaining={60} />);
  const live = screen.getByRole('status');
  expect(live).toHaveTextContent('1 minuto');
  rerender(<ExamTimerAnnouncement timeRemaining={80} />);
  rerender(<ExamTimerAnnouncement timeRemaining={59} />);
  expect(live).toHaveTextContent('1 minuto');
});
it('announces each useful threshold with no per-second updates', () => {
  const { rerender } = render(<ExamTimerAnnouncement timeRemaining={301} />);
  for (const [seconds, label] of [[300, '5 minutos'], [120, '2 minutos'], [60, '1 minuto'], [30, '30 segundos'], [10, '10 segundos'], [0, 'Tempo esgotado']] as const) {
    rerender(<ExamTimerAnnouncement timeRemaining={seconds} />);
    expect(screen.getByRole('status')).toHaveTextContent(label);
    rerender(<ExamTimerAnnouncement timeRemaining={Math.max(0, seconds - 1)} />);
    expect(screen.getByRole('status')).toHaveTextContent(label);
  }
});
