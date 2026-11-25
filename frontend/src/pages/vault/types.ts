import type { StoredItem } from '../../api/client';
import type { ItemPlain } from '../../crypto/items';

export type OpenedItem = StoredItem & { plain?: ItemPlain; tampered?: boolean };

export type VaultSession = {
  userId: string;
  vaultKey: CryptoKey;
  guest: boolean;
  guestItems: StoredItem[];
  saveGuestItem: (item: StoredItem) => void;
  deleteGuestItem: (id: string) => void;
};

export const emptyItem: ItemPlain = { title: '', url: '', username: '', password: '', notes: '' };
