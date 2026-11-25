import { createHmac, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { SimulatedSessions } from './sessions.ts';
import {
  SimulatedHttpError,
  silentTrace,
  type ChangePasswordInput,
  type PublicAccount,
  type RegisterInput,
  type StoredItem,
  type Trace,
} from './types.ts';

type Account = PublicAccount & {
  authHash: string;
  failedAttempts: number;
  lockedUntil: number;
};

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;
const bytes = (value: string) => Buffer.from(value, 'base64url');

/** Modelo didático da API. Maps substituem PostgreSQL e não sobrevivem ao processo. */
export class SimulatedServer {
  readonly sessions = new SimulatedSessions();
  private readonly accounts = new Map<string, Account>();
  private readonly items = new Map<string, StoredItem>();
  private readonly attemptsByIp = new Map<string, { count: number; resetAt: number }>();
  private readonly preloginSecret = randomBytes(32);

  private constructor(
    private readonly dummyHash: string,
    private readonly trace: Trace,
  ) {}

  static async create(trace: Trace = silentTrace) {
    return new SimulatedServer(await argon2.hash(randomBytes(32), ARGON_OPTIONS), trace);
  }

  private accountByEmail(email: string) {
    return [...this.accounts.values()].find(
      (account) => account.email === email.trim().toLowerCase(),
    );
  }

  private limit(ip: string) {
    let attempt = this.attemptsByIp.get(ip);
    if (!attempt || attempt.resetAt <= this.sessions.now) {
      attempt = { count: 0, resetAt: this.sessions.now + 15 * 60_000 };
      this.attemptsByIp.set(ip, attempt);
    }
    attempt.count += 1;
    if (attempt.count > 20) throw new SimulatedHttpError(429, 'rate_limited');
  }

  async register(input: RegisterInput) {
    if (this.accounts.has(input.id) || this.accountByEmail(input.email)) {
      throw new SimulatedHttpError(409, 'conflict');
    }
    const { authKey, ...publicAccount } = input;
    const authHash = await argon2.hash(bytes(authKey), ARGON_OPTIONS);
    this.accounts.set(input.id, {
      ...publicAccount,
      email: input.email.trim().toLowerCase(),
      authHash,
      failedAttempts: 0,
      lockedUntil: 0,
    });
    this.trace('API SIMULADA', 'Argon2id real: 19 MiB, 2 iterações; authKey não é persistido.');
    this.trace(
      'BANCO EM MEMÓRIA',
      'Conta gravada com hash, salt, parâmetros KDF e chave embrulhada.',
    );
  }

  prelogin(email: string, ip = 'demo-client') {
    this.limit(ip);
    const account = this.accountByEmail(email);
    const fakeSalt = createHmac('sha256', this.preloginSecret)
      .update(email.trim().toLowerCase())
      .digest()
      .subarray(0, 16)
      .toString('base64url');
    this.trace(
      'API SIMULADA',
      'Prelogin retorna salt e iterações; email inexistente recebe salt HMAC determinístico.',
    );
    return {
      kdfSalt: account?.kdfSalt ?? fakeSalt,
      kdfIterations: account?.kdfIterations ?? 600000,
    };
  }

  async login(email: string, authKey: string, ip = 'demo-client') {
    this.limit(ip);
    const account = this.accountByEmail(email);
    const valid = await argon2.verify(account?.authHash ?? this.dummyHash, bytes(authKey));
    const locked = Boolean(account && account.lockedUntil > this.sessions.now);

    if (!account || !valid || locked) {
      if (account && !locked) {
        account.failedAttempts += 1;
        if (account.failedAttempts >= 5) {
          const minutes = account.failedAttempts < 10 ? 1 : account.failedAttempts < 15 ? 5 : 15;
          account.lockedUntil = this.sessions.now + minutes * 60_000;
        }
      }
      throw new SimulatedHttpError(locked ? 429 : 401, 'invalid_credentials');
    }

    account.failedAttempts = 0;
    account.lockedUntil = 0;
    const token = this.sessions.create(account.id);
    this.trace(
      'API SIMULADA',
      'AuthKey verificado; token opaco de 32 bytes representa o cookie de sessão.',
    );
    this.trace(
      'BANCO EM MEMÓRIA',
      'A sessão guarda SHA-256(token), prazo absoluto de 8 h e inatividade de 30 min.',
    );
    return { token, account: this.publicAccount(account) };
  }

  private publicAccount(account: Account): PublicAccount {
    const {
      authHash: _hash,
      failedAttempts: _attempts,
      lockedUntil: _lock,
      ...publicAccount
    } = account;
    return publicAccount;
  }

  me(token: string) {
    const userId = this.sessions.authenticate(token);
    return this.publicAccount(this.accounts.get(userId)!);
  }

  logout(token: string) {
    this.sessions.revoke(token);
    this.trace('API SIMULADA', 'Sessão revogada; reutilizar o token resulta em 401.');
  }

  createItem(token: string, input: Omit<StoredItem, 'userId' | 'version'>) {
    const userId = this.sessions.authenticate(token);
    if (this.items.has(input.id)) throw new SimulatedHttpError(409, 'conflict');
    const item = { ...input, userId, version: 1 };
    this.items.set(item.id, item);
    this.trace(
      'BANCO EM MEMÓRIA',
      `Item gravado: IV de ${bytes(item.iv).length} bytes; ciphertext de ${bytes(item.ciphertext).length} bytes.`,
    );
    return { ...item };
  }

  listItems(token: string) {
    const userId = this.sessions.authenticate(token);
    return [...this.items.values()]
      .filter((item) => item.userId === userId)
      .map((item) => ({ ...item }));
  }

  getItem(token: string, itemId: string) {
    const userId = this.sessions.authenticate(token);
    const item = this.items.get(itemId);
    if (!item || item.userId !== userId) throw new SimulatedHttpError(404, 'not_found');
    return { ...item };
  }

  updateItem(
    token: string,
    itemId: string,
    data: Pick<StoredItem, 'iv' | 'ciphertext' | 'version'>,
  ) {
    const item = this.getItem(token, itemId);
    if (item.version !== data.version) throw new SimulatedHttpError(409, 'version_conflict');
    const updated = {
      ...item,
      iv: data.iv,
      ciphertext: data.ciphertext,
      version: item.version + 1,
    };
    this.items.set(itemId, updated);
    return { ...updated };
  }

  deleteItem(token: string, itemId: string) {
    this.getItem(token, itemId);
    this.items.delete(itemId);
  }

  async changePassword(token: string, data: ChangePasswordInput) {
    const userId = this.sessions.authenticate(token);
    const account = this.accounts.get(userId)!;
    if (!(await argon2.verify(account.authHash, bytes(data.currentAuthKey)))) {
      throw new SimulatedHttpError(401, 'invalid_credentials');
    }
    // Prepara o novo hash antes de alterar o estado, representando o commit da transação.
    const authHash = await argon2.hash(bytes(data.newAuthKey), ARGON_OPTIONS);
    Object.assign(account, {
      authHash,
      kdfSalt: data.newKdfSalt,
      kdfIterations: data.newKdfIterations,
      wrappedVaultKey: data.newWrappedVaultKey,
      wrappedVaultIv: data.newWrappedVaultIv,
    });
    this.sessions.revokeOthers(userId, token);
    this.trace(
      'API SIMULADA',
      'Parâmetros e chave embrulhada atualizados; outras sessões revogadas. Itens intactos.',
    );
  }

  /** Acesso deliberado ao armazenamento para as demonstrações de adulteração. */
  corruptCiphertext(itemId: string) {
    const item = this.items.get(itemId)!;
    const corrupted = bytes(item.ciphertext);
    corrupted[0] ^= 1;
    item.ciphertext = corrupted.toString('base64url');
    this.trace('BANCO EM MEMÓRIA', 'Ataque demonstrativo: um bit do ciphertext foi invertido.');
  }

  swapBlobs(firstId: string, secondId: string) {
    const first = this.items.get(firstId)!;
    const second = this.items.get(secondId)!;
    [first.iv, second.iv] = [second.iv, first.iv];
    [first.ciphertext, second.ciphertext] = [second.ciphertext, first.ciphertext];
    this.trace(
      'BANCO EM MEMÓRIA',
      'Ataque demonstrativo: IV e ciphertext trocados entre dois registros.',
    );
  }

  snapshot() {
    return structuredClone({
      users: [...this.accounts.values()],
      sessions: this.sessions.snapshot(),
      vaultItems: [...this.items.values()],
    });
  }
}
