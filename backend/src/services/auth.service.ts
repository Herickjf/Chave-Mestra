import { createHmac, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type pg from 'pg';
import type { Logger } from 'pino';
import type { Config } from '../config.js';
import type { UserRow } from '../types/database.js';
import { fromBase64Url, toBase64Url } from '../utils/encoding.js';
import { HttpError } from '../utils/httpError.js';
import type { ChangePasswordInput, LoginInput, RegisterInput } from '../validation/auth.schemas.js';
import { hashToken, type SessionService } from './session.service.js';

export async function createAuthService(
  config: Config,
  pool: pg.Pool,
  sessions: SessionService,
  log: Logger,
) {
  const argonOptions = {
    type: argon2.argon2id,
    memoryCost: config.ARGON2_MEMORY_KIB,
    timeCost: config.ARGON2_TIME_COST,
    parallelism: 1,
  } as const;

  // Contas inexistentes também passam pelo custo de uma verificação Argon2id.
  const dummyHash = await argon2.hash(randomBytes(32), argonOptions);

  async function register(data: RegisterInput) {
    const hash = await argon2.hash(fromBase64Url(data.authKey), argonOptions);

    await pool.query(
      `INSERT INTO users (
         id, email, auth_hash, kdf_salt, kdf_iterations, wrapped_vault_key, wrapped_vault_iv
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.id,
        data.email,
        hash,
        fromBase64Url(data.kdfSalt),
        data.kdfIterations,
        fromBase64Url(data.wrappedVaultKey),
        fromBase64Url(data.wrappedVaultIv),
      ],
    );

    log.info({ event: 'register', userId: data.id });
  }

  async function prelogin(email: string) {
    const result = await pool.query<Pick<UserRow, 'kdf_salt' | 'kdf_iterations'>>(
      'SELECT kdf_salt, kdf_iterations FROM users WHERE email = $1',
      [email],
    );
    const fakeSalt = createHmac('sha256', config.PRELOGIN_SECRET)
      .update(email)
      .digest()
      .subarray(0, 16);

    return {
      kdfSalt: toBase64Url(result.rows[0]?.kdf_salt ?? fakeSalt),
      kdfIterations: result.rows[0]?.kdf_iterations ?? 600000,
    };
  }

  async function recordFailedAttempt(userId: string) {
    // O incremento e o backoff são calculados atomicamente pelo PostgreSQL.
    await pool.query(
      `UPDATE users
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE
             WHEN failed_attempts + 1 >= 5 THEN now() + CASE
               WHEN failed_attempts + 1 < 10 THEN interval '1 minute'
               WHEN failed_attempts + 1 < 15 THEN interval '5 minutes'
               ELSE interval '15 minutes'
             END
             ELSE NULL
           END
       WHERE id = $1`,
      [userId],
    );
  }

  async function login(data: LoginInput) {
    const result = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [data.email]);
    const user = result.rows[0];
    const valid = await argon2.verify(user?.auth_hash ?? dummyHash, fromBase64Url(data.authKey));
    const locked = Boolean(user?.locked_until && user.locked_until > new Date());

    if (!user || !valid || locked) {
      if (user && !locked) await recordFailedAttempt(user.id);

      log.warn({ event: 'login_failed', userId: user?.id });
      throw new HttpError(locked ? 429 : 401, 'invalid_credentials');
    }

    await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [
      user.id,
    ]);
    const token = await sessions.create(user.id);

    log.info({ event: 'login', userId: user.id });

    return {
      token,
      account: {
        userId: user.id,
        wrappedVaultKey: toBase64Url(user.wrapped_vault_key),
        wrappedVaultIv: toBase64Url(user.wrapped_vault_iv),
      },
    };
  }

  async function me(userId: string) {
    const result = await pool.query<UserRow>(
      `SELECT id, email, kdf_salt, kdf_iterations, wrapped_vault_key, wrapped_vault_iv
       FROM users
       WHERE id = $1`,
      [userId],
    );
    const user = result.rows[0];

    return {
      userId: user.id,
      email: user.email,
      kdfSalt: toBase64Url(user.kdf_salt),
      kdfIterations: user.kdf_iterations,
      wrappedVaultKey: toBase64Url(user.wrapped_vault_key),
      wrappedVaultIv: toBase64Url(user.wrapped_vault_iv),
    };
  }

  async function changePassword(userId: string, token: string, data: ChangePasswordInput) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await client.query<Pick<UserRow, 'auth_hash'>>(
        'SELECT auth_hash FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      );
      const valid = await argon2.verify(
        result.rows[0].auth_hash,
        fromBase64Url(data.currentAuthKey),
      );

      if (!valid) throw new HttpError(401, 'invalid_credentials');

      const newHash = await argon2.hash(fromBase64Url(data.newAuthKey), argonOptions);

      await client.query(
        `UPDATE users
         SET auth_hash = $1,
             kdf_salt = $2,
             kdf_iterations = $3,
             wrapped_vault_key = $4,
             wrapped_vault_iv = $5,
             updated_at = now()
         WHERE id = $6`,
        [
          newHash,
          fromBase64Url(data.newKdfSalt),
          data.newKdfIterations,
          fromBase64Url(data.newWrappedVaultKey),
          fromBase64Url(data.newWrappedVaultIv),
          userId,
        ],
      );
      await client.query(
        `UPDATE sessions
         SET revoked_at = now()
         WHERE user_id = $1 AND token_hash <> $2`,
        [userId, hashToken(token)],
      );
      await client.query('COMMIT');

      log.info({ event: 'password_changed', userId });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return { register, prelogin, login, me, changePassword };
}

export type AuthService = Awaited<ReturnType<typeof createAuthService>>;
