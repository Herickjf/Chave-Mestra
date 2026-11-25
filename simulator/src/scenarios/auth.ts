import { PASSWORD, setup, type Scenario } from './fixtures.ts';
export const auth: Scenario = {
  id: 'auth',
  title: 'Cadastro e login: quem conhece cada segredo?',
  requirements: 'RF01, RF02; RNF01–04, RNF07',
  async run(report) {
    const { server, client } = await setup(report);
    const stored = server.snapshot();
    report.check('O cofre foi aberto no cliente.', client.unlocked);
    report.check(
      'O banco guarda um hash Argon2id.',
      stored.users[0].authHash.startsWith('$argon2id$'),
    );
    report.check(
      'O token de sessão não aparece em texto claro no banco.',
      !JSON.stringify(stored).includes(client.token),
    );
    report.check(
      'O registro da conta não contém senha mestra nem authKey.',
      !JSON.stringify(stored).includes(PASSWORD) && !('authKey' in stored.users[0]),
    );
    report.inspect('Visão do banco: conta e sessão (dados fictícios)', stored);
    const first = server.prelogin('inexistente@demo.local');
    const second = server.prelogin('inexistente@demo.local');
    report.check(
      'Prelogin de conta inexistente mantém salt determinístico.',
      first.kdfSalt === second.kdfSalt,
    );
  },
};
