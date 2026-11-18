// @vitest-environment jsdom
// @ts-expect-error Node types are not included in the browser TypeScript project.
import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('usa o cofre visitante sem gravar no servidor e perde os itens ao recarregar', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: 'unauthorized' }),
  });
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState({}, '', '/login');

  const first = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Continuar sem conta/ }));
  expect(await screen.findByText('Modo visitante.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Nova credencial/ }));
  fireEvent.change(screen.getByPlaceholderText('Ex.: Meu e-mail'), {
    target: { value: 'Email visitante' },
  });
  fireEvent.change(screen.getByPlaceholderText('Senha da conta'), {
    target: { value: 'uma-senha-de-teste' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar credencial' }));
  expect(await screen.findByText('Credencial salva com segurança.')).toBeTruthy();
  expect(screen.getAllByText('Email visitante').length).toBeGreaterThan(0);
  expect(fetchMock.mock.calls.every(([path]) => path === '/api/auth/me')).toBe(true);

  first.unmount();
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Continuar sem conta/ }));
  expect(await screen.findByText('Modo visitante.')).toBeTruthy();
  expect(screen.queryByText('Email visitante')).toBeNull();
});
