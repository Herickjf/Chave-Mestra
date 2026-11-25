import type pg from 'pg';
import type { ItemRow } from '../types/database.js';
import { fromBase64Url, toBase64Url } from '../utils/encoding.js';
import { HttpError } from '../utils/httpError.js';
import type { CreateItemInput, UpdateItemInput } from '../validation/vault.schemas.js';

function serializeItem(row: ItemRow) {
  return {
    id: row.id,
    iv: toBase64Url(row.iv),
    ciphertext: toBase64Url(row.ciphertext),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createVaultService(pool: pg.Pool) {
  async function list(userId: string) {
    const result = await pool.query<ItemRow>(
      `SELECT id, iv, ciphertext, version, created_at, updated_at
       FROM vault_items
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId],
    );

    return result.rows.map(serializeItem);
  }

  async function create(userId: string, data: CreateItemInput) {
    const result = await pool.query<ItemRow>(
      `INSERT INTO vault_items (id, user_id, iv, ciphertext, version)
       VALUES ($1, $2, $3, $4, 1)
       RETURNING id, iv, ciphertext, version, created_at, updated_at`,
      [data.id, userId, fromBase64Url(data.iv), fromBase64Url(data.ciphertext)],
    );

    return serializeItem(result.rows[0]);
  }

  async function find(userId: string, itemId: string) {
    const result = await pool.query<ItemRow>(
      `SELECT id, iv, ciphertext, version, created_at, updated_at
       FROM vault_items
       WHERE id = $1 AND user_id = $2`,
      [itemId, userId],
    );

    if (!result.rowCount) throw new HttpError(404, 'not_found');

    return serializeItem(result.rows[0]);
  }

  async function update(userId: string, itemId: string, data: UpdateItemInput) {
    const result = await pool.query<ItemRow>(
      `UPDATE vault_items
       SET iv = $1, ciphertext = $2, version = version + 1, updated_at = now()
       WHERE id = $3 AND user_id = $4 AND version = $5
       RETURNING id, iv, ciphertext, version, created_at, updated_at`,
      [fromBase64Url(data.iv), fromBase64Url(data.ciphertext), itemId, userId, data.version],
    );

    if (!result.rowCount) {
      // Só distingue conflito de versão depois de confirmar a titularidade do item.
      const existing = await pool.query(
        'SELECT 1 FROM vault_items WHERE id = $1 AND user_id = $2',
        [itemId, userId],
      );

      throw existing.rowCount
        ? new HttpError(409, 'version_conflict')
        : new HttpError(404, 'not_found');
    }

    return serializeItem(result.rows[0]);
  }

  async function remove(userId: string, itemId: string) {
    const result = await pool.query('DELETE FROM vault_items WHERE id = $1 AND user_id = $2', [
      itemId,
      userId,
    ]);

    if (!result.rowCount) throw new HttpError(404, 'not_found');
  }

  return { list, create, find, update, remove };
}

export type VaultService = ReturnType<typeof createVaultService>;
