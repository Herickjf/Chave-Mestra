import { useEffect, useState, type ReactNode } from 'react';
import { api, type Me, type StoredItem } from '../api/client';
import * as account from '../services/auth';
import { SessionContext } from './SessionContext';
import type { Session } from './session.types';

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
    setSession(await account.register(email, password));
  };
  const login = async (email: string, password: string) => {
    setSession(await account.login(email, password));
  };
  const unlock = async (password: string) => {
    setSession(await account.unlock(password));
  };
  const changePassword = async (current: string, next: string) => {
    if (session.status !== 'unlocked') throw new Error('Cofre bloqueado');
    await account.changePassword(current, next);
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
