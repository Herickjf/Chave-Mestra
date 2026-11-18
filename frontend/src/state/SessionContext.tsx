import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Me, type StoredItem } from '../api/client';
import { fromBase64Url, randomBytes, toBase64Url } from '../crypto/encoding';
import { deriveKeys, KDF_ITERATIONS } from '../crypto/kdf';
import { createVaultKey, rewrapVaultKey, unwrapVaultKey } from '../crypto/vault';

type Session =
  | { status: 'loading' | 'anonymous' }
  | { status: 'locked'; userId: string; email: string }
  | { status: 'unlocked'; userId: string; email: string; vaultKey: CryptoKey }
  | { status: 'guest'; userId: string; vaultKey: CryptoKey };
type Context = {
  session: Session;
  guestItems: StoredItem[];
  startGuest: () => Promise<void>;
  saveGuestItem: (item: StoredItem) => void;
  deleteGuestItem: (id: string) => void;
  lockMinutes: number;
  setLockMinutes: (minutes: number) => void;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  lock: () => void;
  logout: () => Promise<void>;
};
const SessionContext = createContext<Context | null>(null);
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider ausente');
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const [guestItems, setGuestItems] = useState<StoredItem[]>([]);
  const [lockMinutes, setLockMinutesState] = useState(
    () => Number(localStorage.getItem('vaultzero/lockMinutes')) || 5,
  );
  const setLockMinutes = (minutes: number) => {
    if (![1, 5, 15].includes(minutes)) return;
    localStorage.setItem('vaultzero/lockMinutes', String(minutes));
    setLockMinutesState(minutes);
  };
  useEffect(() => {
    let live = true;
    api<Me>('/auth/me')
      .then((me) => {
        if (live)
          setSession((current) =>
            current.status === 'loading'
              ? { status: 'locked', userId: me.userId, email: me.email }
              : current,
          );
      })
      .catch(() => {
        if (live)
          setSession((current) =>
            current.status === 'loading' ? { status: 'anonymous' } : current,
          );
      });
    return () => {
      live = false;
    };
  }, []);

  const startGuest = async () => {
    const vaultKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    setGuestItems([]);
    setSession({ status: 'guest', userId: crypto.randomUUID(), vaultKey });
  };
  const saveGuestItem = (item: StoredItem) => {
    setGuestItems((current) => [item, ...current.filter((existing) => existing.id !== item.id)]);
  };
  const deleteGuestItem = (id: string) => {
    setGuestItems((current) => current.filter((item) => item.id !== id));
  };

  const register = async (email: string, password: string) => {
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
    await login(email, password);
  };
  const login = async (email: string, password: string) => {
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
        setSession({ status: 'unlocked', userId: result.userId, email, vaultKey });
      } catch {
        await api('/auth/logout', 'POST').catch(() => undefined);
        throw new Error('A chave do cofre está corrompida.');
      }
    } finally {
      authKey.fill(0);
    }
  };
  const unlock = async (password: string) => {
    const me = await api<Me>('/auth/me');
    const { kek } = await deriveKeys(password, fromBase64Url(me.kdfSalt), me.kdfIterations);
    // A sessão existente é validada por /me; um teste de senha incorreta falha na autenticação GCM.
    const vaultKey = await unwrapVaultKey(
      fromBase64Url(me.wrappedVaultKey),
      fromBase64Url(me.wrappedVaultIv),
      kek,
      me.userId,
    );
    setSession({ status: 'unlocked', userId: me.userId, email: me.email, vaultKey });
  };
  const changePassword = async (current: string, next: string) => {
    if (session.status !== 'unlocked') throw new Error('Cofre bloqueado');
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
  const lock = () => {
    if (session.status === 'guest') {
      setGuestItems([]);
      setSession({ status: 'anonymous' });
      return;
    }
    setSession((s) =>
      s.status === 'unlocked' ? { status: 'locked', userId: s.userId, email: s.email } : s,
    );
  };
  const logout = async () => {
    if (session.status === 'guest') {
      setGuestItems([]);
      setSession({ status: 'anonymous' });
      return;
    }
    try {
      await api('/auth/logout', 'POST');
    } finally {
      setSession({ status: 'anonymous' });
    }
  };
  return (
    <SessionContext.Provider
      value={{
        session,
        guestItems,
        startGuest,
        saveGuestItem,
        deleteGuestItem,
        lockMinutes,
        setLockMinutes,
        register,
        login,
        unlock,
        changePassword,
        lock,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
