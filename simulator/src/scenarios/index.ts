import type { Reporter } from '../reporter.ts';
import type { Scenario } from './fixtures.ts';
import { auth } from './auth.ts';
import { vault } from './vault.ts';
import { tamper, idor, bruteForce } from './security.ts';
import { password, session } from './session.ts';
import { guest, generator } from './local.ts';

export const scenarios: Scenario[] = [
  auth,
  vault,
  tamper,
  password,
  idor,
  session,
  bruteForce,
  guest,
  generator,
];

export async function runScenario(scenario: Scenario, report: Reporter) {
  report.title(scenario.title, scenario.requirements);
  await scenario.run(report);
}
