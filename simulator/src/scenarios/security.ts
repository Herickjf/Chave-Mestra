import { TamperError } from '../../../frontend/src/crypto/items.ts';
import { randomBytes, toBase64Url } from '../../../frontend/src/crypto/encoding.ts';
import { SimulatedClient } from '../client.ts';
import {
  credential,
  EMAIL,
  PASSWORD,
  setup,
  expectFailure,
  status,
  type Scenario,
} from './fixtures.ts';
export const tamper: Scenario = {
  id: 'tamper',
  title: 'Adulteração e troca de blobs: proteção AES-GCM e AAD',
  requirements: 'RF12; RNF05',
  async run(report) {
    const { server, client } = await setup(report);
    const first = await client.createItem(credential);
    const second = await client.createItem({ ...credential, title: 'Outro serviço fictício' });
    server.swapBlobs(first.id, second.id);
    await expectFailure(
      report,
      'Trocar blobs entre itens falha porque o itemId do AAD é diferente.',
      () => client.readItem(first.id),
      (error) => error instanceof TamperError,
    );
    server.swapBlobs(first.id, second.id);
    server.corruptCiphertext(first.id);
    await expectFailure(
      report,
      'Alterar um bit falha na autenticação GCM; nenhum conteúdo é retornado.',
      () => client.readItem(first.id),
      (error) => error instanceof TamperError,
    );
    report.check(
      'O outro item permanece legível.',
      (await client.readItem(second.id)).password === credential.password,
    );
  },
};

export const idor: Scenario = {
  id: 'idor',
  title: 'Autorização: um usuário tenta acessar o cofre de outro',
  requirements: 'RNF06',
  async run(report) {
    const { server, client } = await setup(report);
    const item = await client.createItem(credential);
    const other = new SimulatedClient(server, report.trace);
    await other.register('bruno@demo.local', PASSWORD);
    await other.login('bruno@demo.local', PASSWORD);
    await expectFailure(
      report,
      'Ler item de outro titular retorna 404.',
      () => server.getItem(other.token, item.id),
      status(404),
    );
    await expectFailure(
      report,
      'Editar item de outro titular retorna 404.',
      () => server.updateItem(other.token, item.id, item),
      status(404),
    );
    await expectFailure(
      report,
      'Excluir item de outro titular retorna 404.',
      () => server.deleteItem(other.token, item.id),
      status(404),
    );
    report.check(
      'O titular ainda consegue abrir seu item.',
      (await client.readItem(item.id)).password === credential.password,
    );
  },
};

export const bruteForce: Scenario = {
  id: 'bruteforce',
  title: 'Força bruta: bloqueio por conta e limite por IP',
  requirements: 'RNF09',
  async run(report) {
    const { server } = await setup(report);
    const wrongAuthKey = toBase64Url(randomBytes(32));
    for (let attempt = 1; attempt <= 5; attempt++) {
      await expectFailure(
        report,
        `Tentativa incorreta ${attempt}/5 retorna 401.`,
        () => server.login(EMAIL, wrongAuthKey, 'account-demo'),
        status(401),
      );
    }
    await expectFailure(
      report,
      'A conta bloqueada passa a retornar 429.',
      () => server.login(EMAIL, wrongAuthKey, 'account-demo'),
      status(429),
    );
    server.sessions.advance(1);
    report.trace(
      'API SIMULADA',
      'Relógio avançado 1 minuto; o primeiro bloqueio temporário terminou.',
    );
    await expectFailure(
      report,
      'Depois do prazo, uma senha incorreta volta a ser verificada.',
      () => server.login(EMAIL, wrongAuthKey, 'account-demo'),
      status(401),
    );
    for (let attempt = 0; attempt < 20; attempt++)
      server.prelogin('inexistente@demo.local', 'ip-demo');
    await expectFailure(
      report,
      'A 21ª chamada de prelogin pelo mesmo IP retorna 429.',
      () => server.prelogin('inexistente@demo.local', 'ip-demo'),
      status(429),
    );
  },
};
