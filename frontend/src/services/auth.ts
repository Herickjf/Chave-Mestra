import { api, type Me } from '../api/client';
import { fromBase64Url, randomBytes, toBase64Url } from '../crypto/encoding';
import { deriveKeys, KDF_ITERATIONS } from '../crypto/kdf';
import { createVaultKey, rewrapVaultKey, unwrapVaultKey } from '../crypto/vault';

export const register = async (email: string, password: string) => {
  const userId = crypto.randomUUID();
  const salt = randomBytes(16);
  const { kek, authKey } = await deriveKeys(password, salt);
  try {
    const { wrapped, iv } = await createVaultKey(kek, userId);
    await api('/auth/register', 'POST', {
      id: userId,
      email,
      authKey: toBase64Url(authKey),
      kdfSalt: toBase64Url(salt),
      kdfIterations: KDF_ITERATIONS,
      wrappedVaultKey: toBase64Url(wrapped),
      wrappedVaultIv: toBase64Url(iv),
    });
  } finally {
    authKey.fill(0);
  }
  return login(email, password);
};
export const login = async (email: string, password: string) => {
  const pre = await api<{ kdfSalt: string; kdfIterations: number }>('/auth/prelogin', 'POST', {
    email,
  });
  const { kek, authKey } = await deriveKeys(
    password,
    fromBase64Url(pre.kdfSalt),
    pre.kdfIterations,
  );
  try {
    const result = await api<{ userId: string; wrappedVaultKey: string; wrappedVaultIv: string }>(
      '/auth/login',
      'POST',
      { email, authKey: toBase64Url(authKey) },
    );
    try {
      const vaultKey = await unwrapVaultKey(
        fromBase64Url(result.wrappedVaultKey),
        fromBase64Url(result.wrappedVaultIv),
        kek,
        result.userId,
      );
      return { status: 'unlocked' as const, userId: result.userId, email, vaultKey };
    } catch {
      await api('/auth/logout', 'POST').catch(() => undefined);
      throw new Error('A chave do cofre está corrompida.');
    }
  } finally {
    authKey.fill(0);
  }
};
export const unlock = async (password: string) => {
  const me = await api<Me>('/auth/me');
  const { kek } = await deriveKeys(password, fromBase64Url(me.kdfSalt), me.kdfIterations);
  // A sessão existente é validada por /me; um teste de senha incorreta falha na autenticação GCM.
  const vaultKey = await unwrapVaultKey(
    fromBase64Url(me.wrappedVaultKey),
    fromBase64Url(me.wrappedVaultIv),
    kek,
    me.userId,
  );
  return { status: 'unlocked' as const, userId: me.userId, email: me.email, vaultKey };
};
export const changePassword = async (current: string, next: string) => {
  const me = await api<Me>('/auth/me');
  const oldKeys = await deriveKeys(current, fromBase64Url(me.kdfSalt), me.kdfIterations);
  const newSalt = randomBytes(16);
  const newKeys = await deriveKeys(next, newSalt);
  try {
    const newWrapped = await rewrapVaultKey(
      fromBase64Url(me.wrappedVaultKey),
      fromBase64Url(me.wrappedVaultIv),
      oldKeys.kek,
      newKeys.kek,
      me.userId,
    );
    await api('/auth/change-password', 'POST', {
      currentAuthKey: toBase64Url(oldKeys.authKey),
      newAuthKey: toBase64Url(newKeys.authKey),
      newKdfSalt: toBase64Url(newSalt),
      newKdfIterations: KDF_ITERATIONS,
      newWrappedVaultKey: toBase64Url(newWrapped.wrapped),
      newWrappedVaultIv: toBase64Url(newWrapped.iv),
    });
  } finally {
    oldKeys.authKey.fill(0);
    newKeys.authKey.fill(0);
  }
};
