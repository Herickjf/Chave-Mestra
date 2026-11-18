import { randomBytes, utf8 } from './encoding';

export type ItemPlain = {
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
};
export class TamperError extends Error {
  constructor() {
    super('A credencial não pôde ser autenticada');
    this.name = 'TamperError';
  }
}
const aad = (userId: string, itemId: string) => utf8(`vaultzero/item/v1|${userId}|${itemId}`);
export async function encryptItem(
  item: ItemPlain,
  vaultKey: CryptoKey,
  userId: string,
  itemId: string,
) {
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(userId, itemId) },
      vaultKey,
      utf8(JSON.stringify(item)) as BufferSource,
    ),
  );
  return { iv, ciphertext };
}
export async function decryptItem(
  blob: { iv: Uint8Array; ciphertext: Uint8Array },
  vaultKey: CryptoKey,
  userId: string,
  itemId: string,
): Promise<ItemPlain> {
  try {
    const raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: blob.iv as BufferSource, additionalData: aad(userId, itemId) },
      vaultKey,
      blob.ciphertext as BufferSource,
    );
    const value: unknown = JSON.parse(new TextDecoder().decode(raw));
    if (
      !value ||
      typeof value !== 'object' ||
      !['title', 'url', 'username', 'password', 'notes'].every(
        (k) => typeof (value as Record<string, unknown>)[k] === 'string',
      )
    )
      throw new Error('invalid plaintext');
    return value as ItemPlain;
  } catch {
    throw new TamperError();
  }
}
