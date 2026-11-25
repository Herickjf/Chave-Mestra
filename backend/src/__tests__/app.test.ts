import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createPool } from '../db/pool.js';
import { migrate } from '../db/migrate.js';

const config = loadConfig();
const pool = createPool(config);
let app: Awaited<ReturnType<typeof createApp>>;
const header = { 'X-Requested-With': 'vaultzero' };
const fakeKey = () => randomBytes(32).toString('base64url');
const createUser = async (email: string) => {
  const id = randomUUID();
  const authKey = fakeKey();
  const body = {
    id,
    email,
    authKey,
    kdfSalt: randomBytes(16).toString('base64url'),
    kdfIterations: 600000,
    wrappedVaultKey: randomBytes(48).toString('base64url'),
    wrappedVaultIv: randomBytes(12).toString('base64url'),
  };
  expect((await supertest(app).post('/api/auth/register').set(header).send(body)).status).toBe(201);
  const login = await supertest(app).post('/api/auth/login').set(header).send({ email, authKey });
  expect(login.status).toBe(200);
  return { id, email, authKey, cookie: (login.headers['set-cookie'][0] as string).split(';')[0] };
};

beforeAll(async () => {
  await migrate(pool);
  await migrate(pool);
});

// Cada cenário tem seu próprio contador de rate limit; os dados usam UUIDs exclusivos.
beforeEach(async () => {
  app = await createApp(config, pool);
});
afterAll(async () => {
  await pool.end();
});

describe('API e limites de autorização', () => {
  it('preserva o contrato de prelogin, saúde e proteção das rotas', async () => {
    expect((await supertest(app).get('/api/health')).body).toEqual({ status: 'ok' });
    expect((await supertest(app).get('/api/vault/items')).status).toBe(401);
    expect(
      (await supertest(app).post('/api/auth/prelogin').send({ email: 'a@example.com' })).status,
    ).toBe(403);

    const missingEmail = `${randomUUID()}@example.com`;
    const first = await supertest(app)
      .post('/api/auth/prelogin')
      .set(header)
      .send({ email: missingEmail });
    const repeated = await supertest(app)
      .post('/api/auth/prelogin')
      .set(header)
      .send({ email: missingEmail });
    expect(first.status).toBe(200);
    expect(first.body).toEqual(repeated.body);
    expect(Buffer.from(first.body.kdfSalt, 'base64url')).toHaveLength(16);
    expect(first.body.kdfIterations).toBe(600000);

    const invalid = await supertest(app)
      .post('/api/auth/prelogin')
      .set(header)
      .send({ email: 'invalid' });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ error: 'invalid_input' });
  });

  it('lista, lê, edita e exclui os próprios itens sem alterar o contrato HTTP', async () => {
    const user = await createUser(`${randomUUID()}@example.com`);
    const data = {
      id: randomUUID(),
      iv: randomBytes(12).toString('base64url'),
      ciphertext: randomBytes(40).toString('base64url'),
      version: 1,
    };
    const itemPath = `/api/vault/items/${data.id}`;
    const created = await supertest(app)
      .post('/api/vault/items')
      .set(header)
      .set('Cookie', user.cookie)
      .send(data);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject(data);
    expect(created.body.createdAt).toEqual(expect.any(String));

    const listed = await supertest(app).get('/api/vault/items').set('Cookie', user.cookie);
    expect(listed.body).toEqual([created.body]);
    expect((await supertest(app).get(itemPath).set('Cookie', user.cookie)).body).toEqual(
      created.body,
    );

    const duplicate = await supertest(app)
      .post('/api/vault/items')
      .set(header)
      .set('Cookie', user.cookie)
      .send(data);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: 'conflict' });

    const updatedData = {
      iv: randomBytes(12).toString('base64url'),
      ciphertext: randomBytes(48).toString('base64url'),
      version: 1,
    };
    const updated = await supertest(app)
      .put(itemPath)
      .set(header)
      .set('Cookie', user.cookie)
      .send(updatedData);
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ ...updatedData, id: data.id, version: 2 });

    expect(
      (await supertest(app).delete(itemPath).set(header).set('Cookie', user.cookie)).status,
    ).toBe(204);
    expect((await supertest(app).get(itemPath).set('Cookie', user.cookie)).status).toBe(404);
    expect((await supertest(app).get('/api/vault/items').set('Cookie', user.cookie)).body).toEqual(
      [],
    );
  });

  it('registra, autentica e não guarda authKey em texto claro', async () => {
    const email = `${randomUUID()}@example.com`;
    const user = await createUser(email);
    const row = await pool.query<{ auth_hash: string }>('SELECT auth_hash FROM users WHERE id=$1', [
      user.id,
    ]);
    expect(row.rows[0].auth_hash).toMatch(/^\$argon2id\$/);
    expect(row.rows[0].auth_hash).not.toContain(user.authKey);
    const wrong = await supertest(app)
      .post('/api/auth/login')
      .set(header)
      .send({ email, authKey: fakeKey() });
    const unknown = await supertest(app)
      .post('/api/auth/login')
      .set(header)
      .send({ email: `${randomUUID()}@example.com`, authKey: fakeKey() });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });
  it('isola itens por usuário e aplica versionamento otimista', async () => {
    const a = await createUser(`${randomUUID()}@example.com`);
    const b = await createUser(`${randomUUID()}@example.com`);
    const id = randomUUID();
    const data = {
      id,
      iv: randomBytes(12).toString('base64url'),
      ciphertext: randomBytes(40).toString('base64url'),
      version: 1,
    };
    const created = await supertest(app)
      .post('/api/vault/items')
      .set(header)
      .set('Cookie', a.cookie)
      .send(data);
    expect(created.status).toBe(201);
    for (const method of ['get', 'put', 'delete'] as const) {
      const request = supertest(app)
        [method](`/api/vault/items/${id}`)
        .set(header)
        .set('Cookie', b.cookie);
      const response =
        method === 'put'
          ? await request.send({ iv: data.iv, ciphertext: data.ciphertext, version: 1 })
          : await request;
      expect(response.status).toBe(404);
    }
    const stale = await supertest(app)
      .put(`/api/vault/items/${id}`)
      .set(header)
      .set('Cookie', a.cookie)
      .send({ iv: data.iv, ciphertext: data.ciphertext, version: 2 });
    expect(stale.status).toBe(409);
    const invalid = await supertest(app)
      .post('/api/vault/items')
      .set(header)
      .set('Cookie', a.cookie)
      .send({ ...data, id: randomUUID(), iv: randomBytes(11).toString('base64url') });
    expect(invalid.status).toBe(400);
    const row = await pool.query<{ ciphertext: Buffer }>(
      'SELECT ciphertext FROM vault_items WHERE id=$1',
      [id],
    );
    expect(row.rows[0].ciphertext.equals(Buffer.from(data.ciphertext, 'base64url'))).toBe(true);
    const plaintext = await supertest(app)
      .post('/api/vault/items')
      .set(header)
      .set('Cookie', a.cookie)
      .send({ ...data, id: randomUUID(), title: 'segredo' });
    expect(plaintext.status).toBe(400);
  });
  it('bloqueia tentativas repetidas e revoga a sessão no logout', async () => {
    const user = await createUser(`${randomUUID()}@example.com`);
    for (let attempt = 0; attempt < 5; attempt++) {
      const bad = await supertest(app)
        .post('/api/auth/login')
        .set(header)
        .send({ email: user.email, authKey: fakeKey() });
      expect(bad.status).toBe(401);
    }
    const locked = await supertest(app)
      .post('/api/auth/login')
      .set(header)
      .send({ email: user.email, authKey: user.authKey });
    expect(locked.status).toBe(429);
    expect((await supertest(app).get('/api/auth/me').set('Cookie', user.cookie)).status).toBe(200);
    expect(
      (await supertest(app).post('/api/auth/logout').set(header).set('Cookie', user.cookie)).status,
    ).toBe(200);
    expect((await supertest(app).get('/api/auth/me').set('Cookie', user.cookie)).status).toBe(401);
  });
  it('troca authKey e revoga outras sessões em uma transação', async () => {
    const user = await createUser(`${randomUUID()}@example.com`);
    const second = await supertest(app)
      .post('/api/auth/login')
      .set(header)
      .send({ email: user.email, authKey: user.authKey });
    expect(second.status).toBe(200);
    const newAuthKey = fakeKey();
    const changed = await supertest(app)
      .post('/api/auth/change-password')
      .set(header)
      .set('Cookie', user.cookie)
      .send({
        currentAuthKey: user.authKey,
        newAuthKey,
        newKdfSalt: randomBytes(16).toString('base64url'),
        newKdfIterations: 600000,
        newWrappedVaultKey: randomBytes(48).toString('base64url'),
        newWrappedVaultIv: randomBytes(12).toString('base64url'),
      });
    expect(changed.status).toBe(200);
    expect(
      (
        await supertest(app)
          .get('/api/auth/me')
          .set('Cookie', (second.headers['set-cookie'][0] as string).split(';')[0])
      ).status,
    ).toBe(401);
    expect(
      (
        await supertest(app)
          .post('/api/auth/login')
          .set(header)
          .send({ email: user.email, authKey: user.authKey })
      ).status,
    ).toBe(401);
    expect(
      (
        await supertest(app)
          .post('/api/auth/login')
          .set(header)
          .send({ email: user.email, authKey: newAuthKey })
      ).status,
    ).toBe(200);
  });
});
