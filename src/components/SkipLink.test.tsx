import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SkipLink } from './SkipLink';
afterEach(cleanup);
it('links to and focuses the main without smooth scrolling', () => {
  const scroll = vi.fn();
  render(<><SkipLink /><main id="main-content" tabIndex={-1}>Conteúdo</main></>);
  const main = screen.getByRole('main');
  main.scrollIntoView = scroll;
  expect(screen.getByRole('link')).toHaveAttribute('href', '#main-content');
  fireEvent.click(screen.getByRole('link'));
  expect(main).toHaveFocus();
  expect(scroll).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
});
