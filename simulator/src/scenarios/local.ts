import { randomUUID } from 'node:crypto';
import { defaultGenerator, generatePassword } from '../../../frontend/src/crypto/generator.ts';
import { decryptItem, encryptItem } from '../../../frontend/src/crypto/items.ts';
import { credential, type Scenario } from './fixtures.ts';
export const guest: Scenario = {
  id: 'guest',
  title: 'Modo visitante: criptografia sem conta ou API',
  requirements: 'RF14',
  async run(report) {
    const userId = randomUUID();
    const itemId = randomUUID();
    let key: CryptoKey | null = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const items = new Map<string, Awaited<ReturnType<typeof encryptItem>>>();
    items.set(itemId, await encryptItem(credential, key, userId, itemId));
    report.trace(
      'CLIENTE',
      'Chave AES-256-GCM temporária e blobs cifrados ficam somente na memória da aba simulada.',
    );
    report.check('A chave visitante não é exportável.', key.extractable === false);
    report.check(
      'A credencial pode ser aberta localmente.',
      (await decryptItem(items.get(itemId)!, key, userId, itemId)).password === credential.password,
    );
    items.clear();
    key = null;
    report.trace(
      'CLIENTE',
      'Saída, recarga ou inatividade representada: chave e blobs descartados.',
    );
    report.check(
      'A sessão visitante terminou sem itens ou chave.',
      items.size === 0 && key === null,
    );
    report.note('Este cenário não instancia o servidor nem faz chamadas de API.');
  },
};

export const generator: Scenario = {
  id: 'generator',
  title: 'Gerador de senhas: CSPRNG e classes de caracteres',
  requirements: 'RF07',
  async run(report) {
    const result = generatePassword({ ...defaultGenerator, length: 24 });
    report.trace(
      'CLIENTE',
      'crypto.getRandomValues + amostragem por rejeição + embaralhamento Fisher-Yates.',
    );
    report.inspect('Exemplo fictício gerado agora', result);
    report.check('A senha tem os 24 caracteres solicitados.', result.password.length === 24);
    report.check(
      'Todas as classes selecionadas estão presentes.',
      [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].every((pattern) => pattern.test(result.password)),
    );
  },
};
