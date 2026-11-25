import { SimulatedClient } from '../client.ts';
import {
  credential,
  EMAIL,
  PASSWORD,
  NEXT_PASSWORD,
  setup,
  expectFailure,
  status,
  type Scenario,
} from './fixtures.ts';
export const password: Scenario = {
  id: 'password',
  title: 'Troca da senha mestra sem recifrar as credenciais',
  requirements: 'RF11; RNF03, RNF07',
  async run(report) {
    const { server, client } = await setup(report);
    const item = await client.createItem(credential);
    const anotherTab = new SimulatedClient(server, report.trace);
    await anotherTab.login(EMAIL, PASSWORD);
    const before = JSON.stringify(server.snapshot().vaultItems);
    await client.changePassword(PASSWORD, NEXT_PASSWORD);
    report.check(
      'Os blobs das credenciais ficaram exatamente iguais.',
      before === JSON.stringify(server.snapshot().vaultItems),
    );
    await expectFailure(
      report,
      'A outra sessão foi revogada.',
      () => server.me(anotherTab.token),
      status(401),
    );
    const returning = new SimulatedClient(server, report.trace);
    await expectFailure(
      report,
      'A senha antiga não autentica mais.',
      () => returning.login(EMAIL, PASSWORD),
      status(401),
    );
    await returning.login(EMAIL, NEXT_PASSWORD);
    report.check(
      'A senha nova abre a credencial criada antes da troca.',
      (await returning.readItem(item.id)).password === credential.password,
    );
  },
};

export const session: Scenario = {
  id: 'session',
  title: 'Bloqueio local, expiração da sessão e logout',
  requirements: 'RF03, RF09; RNF07',
  async run(report) {
    const { server, client } = await setup(report);
    const item = await client.createItem(credential);
    client.lock();
    report.trace(
      'CLIENTE',
      'Evento de inatividade representado: a referência à vaultKey é descartada.',
    );
    report.check(
      'Bloquear remove a chave local, mantendo a sessão HTTP simulada.',
      !client.unlocked && Boolean(server.me(client.token)),
    );
    await expectFailure(
      report,
      'O cliente bloqueado não consegue decifrar.',
      () => client.readItem(item.id),
      (error) => error instanceof Error && error.message === 'Cofre bloqueado',
    );
    await client.unlock(PASSWORD);
    report.check(
      'Redigitar a senha abre novamente o cofre.',
      (await client.readItem(item.id)).password === credential.password,
    );
    server.sessions.advance(31);
    report.trace(
      'API SIMULADA',
      'Relógio avançado 31 minutos sem requisições; a janela de inatividade acabou.',
    );
    await expectFailure(
      report,
      'A sessão expirada retorna 401.',
      () => server.me(client.token),
      status(401),
    );
    await client.login(EMAIL, PASSWORD);
    const token = client.token;
    client.logout();
    report.check(
      'Logout descarta a chave e o token no cliente.',
      !client.unlocked && client.token === '',
    );
    await expectFailure(
      report,
      'Reutilizar o token revogado retorna 401.',
      () => server.me(token),
      status(401),
    );
  },
};
