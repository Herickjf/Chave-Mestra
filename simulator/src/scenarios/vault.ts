import { credential, setup, expectFailure, status, type Scenario } from './fixtures.ts';
export const vault: Scenario = {
  id: 'vault',
  title: 'Cofre: CRUD cifrado, versão e vazamento do banco',
  requirements: 'RF04–06, RF13; RNF01, RNF05, RNF06',
  async run(report) {
    const { server, client } = await setup(report);
    const item = await client.createItem(credential);
    const stored = JSON.stringify(server.snapshot());
    report.check(
      'Título, usuário e senha da credencial não aparecem no banco.',
      [credential.title, credential.username, credential.password].every(
        (value) => !stored.includes(value),
      ),
    );
    report.inspect('Visão do banco: apenas blob cifrado e metadados', server.snapshot().vaultItems);
    const opened = await client.readItem(item.id);
    report.check(
      'A decifragem no cliente recupera o conteúdo original.',
      JSON.stringify(opened) === JSON.stringify(credential),
    );
    report.inspect('Visão do cliente após decifrar', opened);
    const found = (await client.listItems()).filter(({ plain }) =>
      plain.title.toLowerCase().includes('email'),
    );
    report.check('A busca acontece localmente sobre o título decifrado.', found.length === 1);
    const updated = await client.updateItem(item.id, { ...credential, notes: 'Nota editada.' }, 1);
    report.check(
      'Editar cria IV novo e incrementa a versão.',
      updated.iv !== item.iv && updated.version === 2,
    );
    await expectFailure(
      report,
      'Uma edição com versão antiga recebe 409.',
      () => client.updateItem(item.id, credential, 1),
      status(409),
    );
    server.deleteItem(client.token, item.id);
    report.check('Excluir remove a credencial do cofre.', (await client.listItems()).length === 0);
  },
};
