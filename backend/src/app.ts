import { createHash, createHmac, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type pg from 'pg';
import pino from 'pino';
import { z, ZodError } from 'zod';
import type { Config } from './config.js';

const uuid = z.string().uuid();
const email = z.string().email().max(254).transform(v => v.trim().toLowerCase());
const bytes = (length?: number, max?: number) => z.string().regex(/^[A-Za-z0-9_-]+$/).refine(v => {
  const b = Buffer.from(v, 'base64url');
  return b.toString('base64url') === v && (length === undefined || b.length === length) && (max === undefined || b.length <= max);
}, 'invalid_base64url');
const authKey = bytes(32);
const salt = bytes(16);
const iv = bytes(12);
const wrapped = bytes(undefined, 128).refine(v => Buffer.from(v, 'base64url').length >= 48);
const ciphertext = bytes(undefined, 65536).refine(v => Buffer.from(v, 'base64url').length >= 16);
const iterations = z.number().int().min(600000).max(5000000);
const registerBody = z.object({ id: uuid, email, authKey, kdfSalt: salt, kdfIterations: iterations, wrappedVaultKey: wrapped, wrappedVaultIv: iv }).strict();
const loginBody = z.object({ email, authKey }).strict();
const preloginBody = z.object({ email }).strict();
const changeBody = z.object({ currentAuthKey: authKey, newAuthKey: authKey, newKdfSalt: salt, newKdfIterations: iterations, newWrappedVaultKey: wrapped, newWrappedVaultIv: iv }).strict();
const itemBody = z.object({ id: uuid, iv, ciphertext, version: z.literal(1) }).strict();
const updateBody = z.object({ iv, ciphertext, version: z.number().int().positive() }).strict();
const hashToken = (token: string) => createHash('sha256').update(token).digest();
const buf = (value: string) => Buffer.from(value, 'base64url');
const b64 = (value: Buffer) => value.toString('base64url');
const wrapAsync = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };
const cookieName = 'vz_session';

type UserRow = { id: string; email: string; auth_hash: string; kdf_salt: Buffer; kdf_iterations: number; wrapped_vault_key: Buffer; wrapped_vault_iv: Buffer; failed_attempts: number; locked_until: Date | null };
type ItemRow = { id: string; iv: Buffer; ciphertext: Buffer; version: number; created_at: Date; updated_at: Date };
const itemJson = (row: ItemRow) => ({ id: row.id, iv: b64(row.iv), ciphertext: b64(row.ciphertext), version: row.version, createdAt: row.created_at, updatedAt: row.updated_at });

export async function createApp(config: Config, pool: pg.Pool) {
  const app = express();
  const log = pino({ redact: ['req.headers.cookie', 'req.headers.authorization'] });
  const argonOptions = { type: argon2.argon2id, memoryCost: config.ARGON2_MEMORY_KIB, timeCost: config.ARGON2_TIME_COST, parallelism: 1 } as const;
  const dummyHash = await argon2.hash(randomBytes(32), argonOptions);
  app.set('trust proxy', 2);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(cors({ origin: config.ALLOWED_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '128kb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('X-Requested-With') !== 'vaultzero') {
      res.status(403).json({ error: 'invalid_request' }); return;
    }
    next();
  });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'rate_limited' } });
  const authenticate = (req: Request, res: Response, next: NextFunction) => { void (async () => {
    const token = req.cookies?.[cookieName];
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) { res.status(401).json({ error: 'unauthorized' }); return; }
    const found = await pool.query<{ user_id: string; email: string }>(
      `UPDATE sessions s SET last_seen_at = now() FROM users u
       WHERE s.token_hash = $1 AND s.user_id = u.id AND s.revoked_at IS NULL
         AND s.expires_at > now() AND s.last_seen_at > now() - ($2::int * interval '1 minute')
       RETURNING s.user_id, u.email`, [hashToken(token), config.SESSION_IDLE_MIN]);
    if (!found.rowCount) { res.status(401).json({ error: 'unauthorized' }); return; }
    res.locals.userId = found.rows[0].user_id;
    res.locals.email = found.rows[0].email;
    next();
  })().catch(next); };
  const requireAuth = authenticate;

  app.get('/api/health', wrapAsync(async (_req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }));

  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const data = registerBody.parse(req.body);
      const hash = await argon2.hash(buf(data.authKey), argonOptions);
      await pool.query(`INSERT INTO users (id,email,auth_hash,kdf_salt,kdf_iterations,wrapped_vault_key,wrapped_vault_iv)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [data.id, data.email, hash, buf(data.kdfSalt), data.kdfIterations, buf(data.wrappedVaultKey), buf(data.wrappedVaultIv)]);
      log.info({ event: 'register', userId: data.id });
      res.status(201).json({});
    } catch (error) { next(error); }
  });

  app.post('/api/auth/prelogin', authLimiter, wrapAsync(async (req, res) => {
    const data = preloginBody.parse(req.body);
    const result = await pool.query<Pick<UserRow, 'kdf_salt' | 'kdf_iterations'>>('SELECT kdf_salt,kdf_iterations FROM users WHERE email=$1', [data.email]);
    const fake = createHmac('sha256', config.PRELOGIN_SECRET).update(data.email).digest().subarray(0, 16);
    res.json({ kdfSalt: b64(result.rows[0]?.kdf_salt ?? fake), kdfIterations: result.rows[0]?.kdf_iterations ?? 600000 });
  }));

  app.post('/api/auth/login', authLimiter, wrapAsync(async (req, res) => {
    const data = loginBody.parse(req.body);
    const result = await pool.query<UserRow>('SELECT * FROM users WHERE email=$1', [data.email]);
    const user = result.rows[0];
    const valid = await argon2.verify(user?.auth_hash ?? dummyHash, buf(data.authKey));
    if (!user || !valid || (user.locked_until && user.locked_until > new Date())) {
      if (user && (!user.locked_until || user.locked_until <= new Date())) {
        await pool.query(`UPDATE users SET failed_attempts=failed_attempts+1,
          locked_until=CASE WHEN failed_attempts+1 >= 5 THEN now() + (CASE WHEN failed_attempts+1 < 10 THEN interval '1 minute' WHEN failed_attempts+1 < 15 THEN interval '5 minutes' ELSE interval '15 minutes' END) ELSE NULL END
          WHERE id=$1`, [user.id]);
      }
      log.warn({ event: 'login_failed', userId: user?.id });
      res.status(user?.locked_until && user.locked_until > new Date() ? 429 : 401).json({ error: 'invalid_credentials' }); return;
    }
    await pool.query('UPDATE users SET failed_attempts=0,locked_until=NULL WHERE id=$1', [user.id]);
    const token = randomBytes(32).toString('base64url');
    await pool.query(`INSERT INTO sessions (user_id,token_hash,expires_at) VALUES ($1,$2,now() + ($3::int * interval '1 hour'))`, [user.id, hashToken(token), config.SESSION_ABSOLUTE_HOURS]);
    res.cookie(cookieName, token, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api', maxAge: config.SESSION_ABSOLUTE_HOURS * 3600000 });
    log.info({ event: 'login', userId: user.id });
    res.json({ userId: user.id, wrappedVaultKey: b64(user.wrapped_vault_key), wrappedVaultIv: b64(user.wrapped_vault_iv) });
  }));

  app.get('/api/auth/me', requireAuth, wrapAsync(async (_req, res) => {
    const result = await pool.query<UserRow>('SELECT id,email,kdf_salt,kdf_iterations,wrapped_vault_key,wrapped_vault_iv FROM users WHERE id=$1', [res.locals.userId]);
    const u = result.rows[0];
    res.json({ userId: u.id, email: u.email, kdfSalt: b64(u.kdf_salt), kdfIterations: u.kdf_iterations, wrappedVaultKey: b64(u.wrapped_vault_key), wrappedVaultIv: b64(u.wrapped_vault_iv) });
  }));

  app.post('/api/auth/logout', requireAuth, wrapAsync(async (req, res) => {
    await pool.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1 AND user_id=$2', [hashToken(req.cookies[cookieName]), res.locals.userId]);
    res.clearCookie(cookieName, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api' });
    res.json({});
  }));

  app.post('/api/auth/change-password', requireAuth, wrapAsync(async (req, res) => {
    const data = changeBody.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<UserRow>('SELECT auth_hash FROM users WHERE id=$1 FOR UPDATE', [res.locals.userId]);
      if (!await argon2.verify(result.rows[0].auth_hash, buf(data.currentAuthKey))) {
        await client.query('ROLLBACK'); res.status(401).json({ error: 'invalid_credentials' }); return;
      }
      const newHash = await argon2.hash(buf(data.newAuthKey), argonOptions);
      await client.query(`UPDATE users SET auth_hash=$1,kdf_salt=$2,kdf_iterations=$3,wrapped_vault_key=$4,wrapped_vault_iv=$5,updated_at=now() WHERE id=$6`,
        [newHash, buf(data.newKdfSalt), data.newKdfIterations, buf(data.newWrappedVaultKey), buf(data.newWrappedVaultIv), res.locals.userId]);
      await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND token_hash<>$2', [res.locals.userId, hashToken(req.cookies[cookieName])]);
      await client.query('COMMIT');
      log.info({ event: 'password_changed', userId: res.locals.userId });
      res.json({});
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }));

  app.get('/api/vault/items', requireAuth, wrapAsync(async (_req, res) => {
    const result = await pool.query<ItemRow>('SELECT id,iv,ciphertext,version,created_at,updated_at FROM vault_items WHERE user_id=$1 ORDER BY updated_at DESC', [res.locals.userId]);
    res.json(result.rows.map(itemJson));
  }));
  app.post('/api/vault/items', requireAuth, wrapAsync(async (req, res) => {
    const data = itemBody.parse(req.body);
    const result = await pool.query<ItemRow>(`INSERT INTO vault_items (id,user_id,iv,ciphertext,version) VALUES ($1,$2,$3,$4,1)
      RETURNING id,iv,ciphertext,version,created_at,updated_at`, [data.id, res.locals.userId, buf(data.iv), buf(data.ciphertext)]);
    res.status(201).json(itemJson(result.rows[0]));
  }));
  app.get('/api/vault/items/:id', requireAuth, wrapAsync(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const result = await pool.query<ItemRow>('SELECT id,iv,ciphertext,version,created_at,updated_at FROM vault_items WHERE id=$1 AND user_id=$2', [id, res.locals.userId]);
    if (!result.rowCount) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(itemJson(result.rows[0]));
  }));
  app.put('/api/vault/items/:id', requireAuth, wrapAsync(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const data = updateBody.parse(req.body);
    const result = await pool.query<ItemRow>(`UPDATE vault_items SET iv=$1,ciphertext=$2,version=version+1,updated_at=now()
      WHERE id=$3 AND user_id=$4 AND version=$5 RETURNING id,iv,ciphertext,version,created_at,updated_at`,
      [buf(data.iv), buf(data.ciphertext), id, res.locals.userId, data.version]);
    if (!result.rowCount) {
      const exists = await pool.query('SELECT 1 FROM vault_items WHERE id=$1 AND user_id=$2', [id, res.locals.userId]);
      res.status(exists.rowCount ? 409 : 404).json({ error: exists.rowCount ? 'version_conflict' : 'not_found' }); return;
    }
    res.json(itemJson(result.rows[0]));
  }));
  app.delete('/api/vault/items/:id', requireAuth, wrapAsync(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const result = await pool.query('DELETE FROM vault_items WHERE id=$1 AND user_id=$2', [id, res.locals.userId]);
    if (!result.rowCount) { res.status(404).json({ error: 'not_found' }); return; }
    res.status(204).end();
  }));

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError || error instanceof SyntaxError) { res.status(400).json({ error: 'invalid_input' }); return; }
    if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') { res.status(413).json({ error: 'payload_too_large' }); return; }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') { res.status(409).json({ error: 'conflict' }); return; }
    log.error({ event: 'server_error', kind: error instanceof Error ? error.name : 'unknown' });
    res.status(500).json({ error: 'internal_error' });
  });
  return app;
}
