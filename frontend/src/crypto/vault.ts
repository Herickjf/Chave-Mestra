import { randomBytes, utf8 } from './encoding';

const aad = (userId: string) => utf8(`vaultzero/vaultkey/v1|${userId}`);
const importVaultKey = (raw: Uint8Array) =>
  crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
export async function createVaultKey(kek: CryptoKey, userId: string) {
  const raw = randomBytes(32);
  try {
    const iv = randomBytes(12);
    const wrapped = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(userId) },
        kek,
        raw,
      ),
    );
    return { vaultKey: await importVaultKey(raw), wrapped, iv };
  } finally {
    raw.fill(0);
  }
}
export async function unwrapVaultKey(
  wrapped: Uint8Array,
  iv: Uint8Array,
  kek: CryptoKey,
  userId: string,
) {
  const raw = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(userId) },
      kek,
      wrapped as BufferSource,
    ),
  );
  try {
    return await importVaultKey(raw);
  } finally {
    raw.fill(0);
  }
}
export async function rewrapVaultKey(
  wrapped: Uint8Array,
  oldIv: Uint8Array,
  oldKek: CryptoKey,
  newKek: CryptoKey,
  userId: string,
) {
  const raw = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: oldIv as BufferSource, additionalData: aad(userId) },
      oldKek,
      wrapped as BufferSource,
    ),
  );
  try {
    const iv = randomBytes(12);
    return {
      wrapped: new Uint8Array(
        await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(userId) },
          newKek,
          raw,
        ),
      ),
      iv,
    };
  } finally {
    raw.fill(0);
  }
}
