import { randomUUID } from 'node:crypto';
import { fromBase64Url, randomBytes, toBase64Url } from '../../frontend/src/crypto/encoding.ts';
import { deriveKeys, KDF_ITERATIONS } from '../../frontend/src/crypto/kdf.ts';
import { createVaultKey, rewrapVaultKey, unwrapVaultKey } from '../../frontend/src/crypto/vault.ts';
import { decryptItem, encryptItem, type ItemPlain } from '../../frontend/src/crypto/items.ts';
import { SimulatedServer } from './server.ts';
import { silentTrace, type Trace } from './types.ts';

/** Representa a memória de uma aba. Usa os módulos criptográficos reais do frontend. */
export class SimulatedClient {
  token = '';
  private userId = '';
  private vaultKey: CryptoKey | null = null;

  constructor(
    readonly server: SimulatedServer,
    private readonly trace: Trace = silentTrace,
  ) {}

  get unlocked() {
    return this.vaultKey !== null;
  }

  async register(email: string, password: string) {
    const id = randomUUID();
    const salt = randomBytes(16);
    this.trace(
      'CLIENTE',
      'Senha mestra + salt aleatório -> PBKDF2-SHA256 (600.000) -> HKDF -> KEK e authKey.',
    );
    const { kek, authKey } = await deriveKeys(password, salt);
    try {
      const { wrapped, iv } = await createVaultKey(kek, id);
      this.trace(
        'CLIENTE',
        'VaultKey aleatória de 256 bits é embrulhada com a KEK usando AES-GCM.',
      );
      this.trace(
        'REDE SIMULADA',
        'POST /auth/register: email, UUID, authKey, salt, iterações e chave embrulhada.',
      );
      await this.server.register({
        id,
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
  }

  async login(email: string, password: string) {
    this.lock();
    this.trace('REDE SIMULADA', 'POST /auth/prelogin: consulta os parâmetros públicos do KDF.');
    const prelogin = this.server.prelogin(email);
    const { kek, authKey } = await deriveKeys(
      password,
      fromBase64Url(prelogin.kdfSalt),
      prelogin.kdfIterations,
    );
    try {
      this.trace(
        'REDE SIMULADA',
        'POST /auth/login: envia email e authKey, nunca a senha mestra ou KEK.',
      );
      const { token, account } = await this.server.login(email, toBase64Url(authKey));
      this.token = token;
      this.userId = account.id;
      try {
        this.vaultKey = await unwrapVaultKey(
          fromBase64Url(account.wrappedVaultKey),
          fromBase64Url(account.wrappedVaultIv),
          kek,
          account.id,
        );
      } catch (error) {
        this.server.logout(token);
        this.token = '';
        throw error;
      }
      this.trace(
        'CLIENTE',
        `Chave do cofre aberta em memória; extractable=${this.vaultKey.extractable}.`,
      );
    } finally {
      authKey.fill(0);
    }
  }

  private key() {
    if (!this.vaultKey) throw new Error('Cofre bloqueado');
    return this.vaultKey;
  }

  async createItem(plain: ItemPlain) {
    const id = randomUUID();
    const blob = await encryptItem(plain, this.key(), this.userId, id);
    this.trace('CLIENTE', 'JSON -> AES-256-GCM; IV novo de 96 bits; AAD contém userId e itemId.');
    this.trace('REDE SIMULADA', 'POST /vault/items: somente UUID, IV, ciphertext e versão.');
    return this.server.createItem(this.token, {
      id,
      iv: toBase64Url(blob.iv),
      ciphertext: toBase64Url(blob.ciphertext),
    });
  }

  async readItem(itemId: string) {
    const key = this.key();
    const item = this.server.getItem(this.token, itemId);
    return decryptItem(
      { iv: fromBase64Url(item.iv), ciphertext: fromBase64Url(item.ciphertext) },
      key,
      this.userId,
      item.id,
    );
  }

  async listItems() {
    const key = this.key();
    return Promise.all(
      this.server.listItems(this.token).map(async (item) => ({
        id: item.id,
        plain: await decryptItem(
          { iv: fromBase64Url(item.iv), ciphertext: fromBase64Url(item.ciphertext) },
          key,
          this.userId,
          item.id,
        ),
      })),
    );
  }

  async updateItem(itemId: string, plain: ItemPlain, expectedVersion: number) {
    const blob = await encryptItem(plain, this.key(), this.userId, itemId);
    this.trace(
      'REDE SIMULADA',
      'PUT /vault/items/:id: novo blob e versão esperada para controle otimista.',
    );
    return this.server.updateItem(this.token, itemId, {
      iv: toBase64Url(blob.iv),
      ciphertext: toBase64Url(blob.ciphertext),
      version: expectedVersion,
    });
  }

  async changePassword(current: string, next: string) {
    this.key();
    const account = this.server.me(this.token);
    const oldKeys = await deriveKeys(
      current,
      fromBase64Url(account.kdfSalt),
      account.kdfIterations,
    );
    const newSalt = randomBytes(16);
    const newKeys = await deriveKeys(next, newSalt);
    try {
      const changed = await rewrapVaultKey(
        fromBase64Url(account.wrappedVaultKey),
        fromBase64Url(account.wrappedVaultIv),
        oldKeys.kek,
        newKeys.kek,
        account.id,
      );
      this.trace(
        'CLIENTE',
        'A mesma vaultKey é reembrulhada com a nova KEK; as credenciais não são recifradas.',
      );
      await this.server.changePassword(this.token, {
        currentAuthKey: toBase64Url(oldKeys.authKey),
        newAuthKey: toBase64Url(newKeys.authKey),
        newKdfSalt: toBase64Url(newSalt),
        newKdfIterations: KDF_ITERATIONS,
        newWrappedVaultKey: toBase64Url(changed.wrapped),
        newWrappedVaultIv: toBase64Url(changed.iv),
      });
    } finally {
      oldKeys.authKey.fill(0);
      newKeys.authKey.fill(0);
    }
  }

  lock() {
    this.vaultKey = null;
  }

  async unlock(password: string) {
    const account = this.server.me(this.token);
    const { kek, authKey } = await deriveKeys(
      password,
      fromBase64Url(account.kdfSalt),
      account.kdfIterations,
    );
    try {
      this.vaultKey = await unwrapVaultKey(
        fromBase64Url(account.wrappedVaultKey),
        fromBase64Url(account.wrappedVaultIv),
        kek,
        account.id,
      );
      this.userId = account.id;
    } finally {
      authKey.fill(0);
    }
  }

  logout() {
    try {
      this.server.logout(this.token);
    } finally {
      this.lock();
      this.token = '';
      this.userId = '';
    }
  }
}
