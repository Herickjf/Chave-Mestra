// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionProvider } from '../../state/SessionProvider';
import { Register } from './Register';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('impede cadastro com senha mestra fraca mesmo após confirmação', () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  render(
    <MemoryRouter>
      <SessionProvider>
        <Register />
      </SessionProvider>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByPlaceholderText('voce@exemplo.com'), {
    target: { value: 'alice@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Crie uma senha mestra forte'), {
    target: { value: 'abc123' },
  });
  fireEvent.change(screen.getByPlaceholderText('Repita sua senha mestra'), {
    target: { value: 'abc123' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: /Criar meu cofre/ }).hasAttribute('disabled')).toBe(
    true,
  );
});
