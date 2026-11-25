import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions } from 'express';
import type pg from 'pg';
import type { Config } from '../config.js';

export const SESSION_COOKIE_NAME = 'vz_session';
export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api',
};

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export function createSessionService(config: Config, pool: pg.Pool) {
  async function findActive(token: unknown) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return null;
    }

    const result = await pool.query<{ user_id: string; email: string }>(
      `UPDATE sessions AS session
       SET last_seen_at = now()
       FROM users AS account
       WHERE session.token_hash = $1
         AND session.user_id = account.id
         AND session.revoked_at IS NULL
         AND session.expires_at > now()
         AND session.last_seen_at > now() - ($2::int * interval '1 minute')
       RETURNING session.user_id, account.email`,
      [hashToken(token), config.SESSION_IDLE_MIN],
    );

    return result.rows[0] ?? null;
  }

  async function create(userId: string) {
    const token = randomBytes(32).toString('base64url');

    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3::int * interval '1 hour'))`,
      [userId, hashToken(token), config.SESSION_ABSOLUTE_HOURS],
    );

    return token;
  }

  async function revoke(userId: string, token: string) {
    await pool.query(
      `UPDATE sessions
       SET revoked_at = now()
       WHERE token_hash = $1 AND user_id = $2`,
      [hashToken(token), userId],
    );
  }

  return { findActive, create, revoke };
}

export type SessionService = ReturnType<typeof createSessionService>;
