import { utf8 } from './encoding';

export const KDF_ITERATIONS = 600_000;
export async function deriveKeys(
  password: string,
  salt: Uint8Array,
  iterations = KDF_ITERATIONS,
): Promise<{ kek: CryptoKey; authKey: Uint8Array }> {
  if (iterations < KDF_ITERATIONS || salt.length !== 16)
    throw new Error('Parâmetros de derivação inválidos');
  const passwordKey = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const masterBits = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: salt as BufferSource, iterations
      },
      passwordKey,
      256,
    ),
  );
  try {
    const masterKey = await crypto.subtle.importKey('raw', masterBits, 'HKDF', false, [
      'deriveBits',
      'deriveKey',
    ]);
    const hkdf = (info: string) => ({
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: utf8(info),
    });
    const kek = await crypto.subtle.deriveKey(
      hkdf('vaultzero/enc'),
      masterKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const authKey = new Uint8Array(
      await crypto.subtle.deriveBits(hkdf('vaultzero/auth'), masterKey, 256),
    );
    return { kek, authKey };
  } finally {
    masterBits.fill(0);
  }
}
