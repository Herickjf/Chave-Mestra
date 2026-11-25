import assert from 'node:assert/strict';
import test from 'node:test';
import { Reporter } from './reporter.ts';
import { runScenario, scenarios } from './scenarios/index.ts';
import { SimulatedSessions } from './sessions.ts';
import { SimulatedHttpError } from './types.ts';

for (const scenario of scenarios) {
  test(`fluxo completo: ${scenario.id}`, { timeout: 60_000 }, async () => {
    const report = new Reporter(() => {});
    await runScenario(scenario, report);
    assert.ok(report.checks > 0);
  });
}

test('atividade renova a janela de inatividade, mas não o teto absoluto de oito horas', () => {
  const sessions = new SimulatedSessions();
  const token = sessions.create('usuario-de-teste');
  for (let minute = 20; minute < 480; minute += 20) {
    sessions.advance(20);
    assert.equal(sessions.authenticate(token), 'usuario-de-teste');
  }
  sessions.advance(20);
  assert.throws(
    () => sessions.authenticate(token),
    (error: unknown) => error instanceof SimulatedHttpError && error.status === 401,
  );
});

test('o relógio não pode retroceder e snapshots não alteram as sessões', () => {
  const sessions = new SimulatedSessions();
  const token = sessions.create('usuario-de-teste');
  const snapshot = sessions.snapshot();
  snapshot[0].revoked = true;
  assert.equal(sessions.authenticate(token), 'usuario-de-teste');
  assert.throws(() => sessions.advance(-1));
  assert.throws(() => sessions.advance(Number.NaN));
});
