import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { Reporter } from './reporter.ts';
import { runScenario, scenarios } from './scenarios/index.ts';

const help = `VaultZero — simulador de arquitetura no terminal

Uso:
  npm start                     Menu quando há terminal; roteiro completo se a entrada for redirecionada
  npm run demo                  Todos os cenários, sem perguntas
  npm start -- --scenario tamper Executa somente um cenário
  npm start -- --list            Lista os identificadores dos cenários
  npm start -- --interactive     Força o menu, inclusive com entrada redirecionada
  npm start -- --help            Mostra esta ajuda

Criptografia real do frontend + Argon2id real.
API, rede, cookie, relógio e banco são simulados em memória.
Os exemplos usam somente dados fictícios; nada é gravado em banco ou arquivo.
`;

function listScenarios() {
  for (const [index, scenario] of scenarios.entries()) {
    console.log(`  ${index + 1}. ${scenario.id.padEnd(12)} ${scenario.title}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(help);
    return;
  }
  if (args.length === 1 && args[0] === '--list') {
    listScenarios();
    return;
  }

  const report: Reporter = new Reporter();
  const runAll = async () => {
    const previousChecks = report.checks;
    for (const scenario of scenarios) await runScenario(scenario, report);
    console.log(
      `\nRoteiro concluído: ${scenarios.length} cenários; ${report.checks - previousChecks} verificações aprovadas.`,
    );
  };

  if (args.length === 2 && args[0] === '--scenario') {
    const selected = scenarios.find((scenario) => scenario.id === args[1]);
    if (!selected) throw new Error(`Cenário desconhecido: ${args[1]}. Use --list.`);
    console.log(help.split('Uso:')[0].trim());
    console.log('Criptografia real; API e armazenamento simulados em memória. Dados fictícios.');
    await runScenario(selected, report);
    console.log(`\n${report.checks} verificações aprovadas.`);
    return;
  }

  const demo = (args.length === 1 && args[0] === '--demo') || (args.length === 0 && !stdin.isTTY);
  const interactive =
    (args.length === 1 && args[0] === '--interactive') || (args.length === 0 && stdin.isTTY);
  if (!demo && !interactive) throw new Error('Opções inválidas. Use --help.');

  console.log(help);
  if (demo) {
    await runAll();
    return;
  }

  const input = createInterface({ input: stdin, output: stdout, terminal: Boolean(stdin.isTTY) });
  const lines = input[Symbol.asyncIterator]();
  try {
    while (true) {
      console.log('\nEscolha um processo (cada execução começa com memória vazia):');
      listScenarios();
      console.log('  a. Todos os cenários\n  0. Sair');
      stdout.write('\nOpção: ');
      const answer = await lines.next();
      if (answer.done || answer.value.trim() === '0') break;
      const value = answer.value.trim().toLowerCase();
      if (value === 'a') {
        await runAll();
        continue;
      }
      const selected =
        scenarios.find((scenario) => scenario.id === value) ??
        (/^[1-9]$/.test(value) ? scenarios[Number(value) - 1] : undefined);
      if (!selected) {
        console.log('Opção inválida. Use o número ou o identificador.');
        continue;
      }
      await runScenario(selected, report);
    }
  } finally {
    input.close();
  }
  console.log('\nSimulador encerrado.');
}

main().catch((error: unknown) => {
  console.error(`\nFalha: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
