import { describe, expect, it } from 'vitest';
import { deriveKeys } from './kdf';
import { createVaultKey, rewrapVaultKey, unwrapVaultKey } from './vault';
import { decryptItem, encryptItem, TamperError } from './items';
import { generatePassword } from './generator';
import { randomBytes } from './encoding';

describe('contrato criptográfico', () => {
  it('isola authKey, autentica AAD e detecta adulteração', async () => {
    const userId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const first = await deriveKeys('uma senha mestra suficientemente longa', randomBytes(16));
    const { vaultKey, wrapped, iv } = await createVaultKey(first.kek, userId);
    expect(first.authKey).toHaveLength(32);
    expect(first.kek.extractable).toBe(false);
    expect(vaultKey.extractable).toBe(false);
    const item = {
      title: 'Teste',
      url: 'https://example.com',
      username: 'alice',
      password: 'segredo',
      notes: '',
    };
    const blob = await encryptItem(item, vaultKey, userId, itemId);
    expect(await decryptItem(blob, vaultKey, userId, itemId)).toEqual(item);
    await expect(decryptItem(blob, vaultKey, userId, crypto.randomUUID())).rejects.toBeInstanceOf(
      TamperError,
    );
    const corrupted = { ...blob, ciphertext: blob.ciphertext.slice() };
    corrupted.ciphertext[0] ^= 1;
    await expect(decryptItem(corrupted, vaultKey, userId, itemId)).rejects.toBeInstanceOf(
      TamperError,
    );
    await expect(unwrapVaultKey(wrapped, iv, first.kek, crypto.randomUUID())).rejects.toThrow();
  }, 20_000);
  it('troca a senha sem alterar a chave do cofre', async () => {
    const userId = crypto.randomUUID();
    const salt = randomBytes(16);
    const oldKeys = await deriveKeys('senha mestra antiga e longa', salt);
    const repeated = await deriveKeys('senha mestra antiga e longa', salt);
    expect(repeated.authKey).toEqual(oldKeys.authKey);
    const { wrapped, iv } = await createVaultKey(oldKeys.kek, userId);
    const newKeys = await deriveKeys('nova senha mestra mais longa ainda', randomBytes(16));
    expect(newKeys.authKey).not.toEqual(oldKeys.authKey);
    const changed = await rewrapVaultKey(wrapped, iv, oldKeys.kek, newKeys.kek, userId);
    const key = await unwrapVaultKey(changed.wrapped, changed.iv, newKeys.kek, userId);
    const itemId = crypto.randomUUID();
    const plain = { title: 'Email', url: '', username: '', password: 'abc', notes: '' };
    const blob = await encryptItem(plain, key, userId, itemId);
    expect(await decryptItem(blob, key, userId, itemId)).toEqual(plain);
    await expect(
      unwrapVaultKey(changed.wrapped, changed.iv, oldKeys.kek, userId),
    ).rejects.toThrow();
  }, 20_000);
});

it('gera senha com o comprimento e todas as classes selecionadas', () => {
  const result = generatePassword({
    length: 32,
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: true,
  });
  expect(result.password).toHaveLength(32);
  expect(result.password).toMatch(/[a-z]/);
  expect(result.password).toMatch(/[A-Z]/);
  expect(result.password).toMatch(/[0-9]/);
  expect(result.password).toMatch(/[^a-zA-Z0-9]/);
  expect(result.password).not.toMatch(/[0OIlio]/);
  expect(result.entropy).toBeGreaterThan(150);
});
