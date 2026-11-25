import type { StoredItem } from '../api/client';
export type Session =
  | { status: 'loading' | 'anonymous' }
  | { status: 'locked'; userId: string; email: string }
  | { status: 'unlocked'; userId: string; email: string; vaultKey: CryptoKey }
  | { status: 'guest'; userId: string; vaultKey: CryptoKey };

export type SessionContextValue = {
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
