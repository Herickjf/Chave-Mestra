import assert from 'node:assert/strict';
import type { Trace } from './types.ts';

export class Reporter {
  private stepNumber = 0;
  checks = 0;

  constructor(private readonly output: (line: string) => void = console.log) {}

  title(title: string, requirements: string) {
    this.stepNumber = 0;
    this.output(`\n${'='.repeat(72)}\n${title}\nRequisitos ilustrados: ${requirements}\n`);
  }

  readonly trace: Trace = (layer, message) => {
    this.stepNumber += 1;
    this.output(`${String(this.stepNumber).padStart(2, '0')} [${layer}] ${message}`);
  };

  check(description: string, condition: unknown): void {
    assert.ok(condition, description);
    this.checks += 1;
    this.output(`   [OK] ${description}`);
  }

  inspect(label: string, value: unknown) {
    this.output(`\n${label}\n${JSON.stringify(value, null, 2)}\n`);
  }

  note(message: string) {
    this.output(`   ${message}`);
  }
}
