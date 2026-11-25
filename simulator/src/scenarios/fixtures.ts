import type { ItemPlain } from '../../../frontend/src/crypto/items.ts';
import { SimulatedClient } from '../client.ts';
import type { Reporter } from '../reporter.ts';
import { SimulatedServer } from '../server.ts';
import { SimulatedHttpError } from '../types.ts';

export const EMAIL = 'ana@demo.local';

export const PASSWORD = 'Mestra didatica: lua-cafe-2026!';

export const NEXT_PASSWORD = 'Outra mestra: sol-livro-2026!';

export const credential: ItemPlain = {
  title: 'Email fictício',
  url: 'https://example.com',
  username: 'ana-demo',
  password: 'Demo!Credencial-73',
  notes: 'Dados fictícios para a demonstração.',
};

export type Scenario = {
  id: string;
  title: string;
  requirements: string;
  run: (report: Reporter) => Promise<void>;
};

export async function setup(report: Reporter) {
  const server = await SimulatedServer.create(report.trace);
  const client = new SimulatedClient(server, report.trace);
  await client.register(EMAIL, PASSWORD);
  await client.login(EMAIL, PASSWORD);
  return { server, client };
}

export async function expectFailure(
  report: Reporter,
  label: string,
  operation: () => unknown | Promise<unknown>,
  matches: (error: unknown) => boolean,
) {
  let caught: unknown;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  report.check(label, caught !== undefined && matches(caught));
  report.note(`Resultado esperado: ${caught instanceof Error ? caught.message : String(caught)}`);
}

export const status = (expected: number) => (error: unknown) =>
  error instanceof SimulatedHttpError && error.status === expected;
