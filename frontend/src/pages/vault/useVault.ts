import { useEffect, useMemo, useState } from 'react';
import { api, type StoredItem } from '../../api/client';
import { fromBase64Url, toBase64Url } from '../../crypto/encoding';
import { decryptItem, encryptItem, type ItemPlain, TamperError } from '../../crypto/items';
import { errorText } from '../../utils/errors';
import type { OpenedItem, VaultSession } from './types';

export function useVault({
  userId,
  vaultKey,
  guest,
  guestItems,
  saveGuestItem,
  deleteGuestItem,
}: VaultSession) {
  const [items, setItems] = useState<OpenedItem[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reveal, setReveal] = useState(false);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const stored = guest ? guestItems : await api<StoredItem[]>('/vault/items');
      const opened = await Promise.all(
        stored.map(async (item) => {
          try {
            return {
              ...item,
              plain: await decryptItem(
                { iv: fromBase64Url(item.iv), ciphertext: fromBase64Url(item.ciphertext) },
                vaultKey,
                userId,
                item.id,
              ),
            };
          } catch (e) {
            if (e instanceof TamperError) return { ...item, tampered: true };
            throw e;
          }
        }),
      );
      setItems(opened);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [userId, vaultKey]);
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          item.tampered ||
          `${item.plain?.title} ${item.plain?.url}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [items, query],
  );
  const active = items.find((item) => item.id === selected);
  const save = async (plain: ItemPlain) => {
    try {
      const id = creating ? crypto.randomUUID() : active!.id;
      const encrypted = await encryptItem(plain, vaultKey, userId, id);
      const body = {
        id,
        iv: toBase64Url(encrypted.iv),
        ciphertext: toBase64Url(encrypted.ciphertext),
        version: creating ? 1 : active!.version,
      };
      if (guest) {
        const now = new Date().toISOString();
        const stored: StoredItem = {
          ...body,
          version: creating ? 1 : active!.version + 1,
          createdAt: creating ? now : active!.createdAt,
          updatedAt: now,
        };
        saveGuestItem(stored);
        setItems((current) => [{ ...stored, plain }, ...current.filter((item) => item.id !== id)]);
      } else {
        await api(
          `/vault/items${creating ? '' : `/${id}`}`,
          creating ? 'POST' : 'PUT',
          creating ? body : { iv: body.iv, ciphertext: body.ciphertext, version: body.version },
        );
      }
      setCreating(false);
      setEditing(false);
      setSelected(id);
      setMessage('Credencial salva com segurança.');
      if (!guest) await load();
    } catch (e) {
      setError(errorText(e));
    }
  };
  const remove = async () => {
    if (!active || !window.confirm('Excluir esta credencial? Essa ação não pode ser desfeita.'))
      return;
    try {
      if (guest) {
        deleteGuestItem(active.id);
        setItems((current) => current.filter((item) => item.id !== active.id));
      } else {
        await api(`/vault/items/${active.id}`, 'DELETE');
      }
      setSelected(null);
      setMessage('Credencial excluída.');
      if (!guest) await load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return {
    items,
    query,
    setQuery,
    selected,
    setSelected,
    editing,
    setEditing,
    creating,
    setCreating,
    loading,
    message,
    setMessage,
    error,
    reveal,
    setReveal,
    filtered,
    active,
    save,
    remove,
  };
}
