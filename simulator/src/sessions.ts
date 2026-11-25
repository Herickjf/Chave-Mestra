import { createHash, randomBytes } from 'node:crypto';
import { SimulatedHttpError } from './types.ts';

type Session = {
  userId: string;
  tokenHash: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  revoked: boolean;
};

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Relógio manual: não é necessário aguardar minutos para demonstrar expiração. */
export class SimulatedSessions {
  private readonly rows = new Map<string, Session>();
  private elapsedMs = 0;

  get now() {
    return this.elapsedMs;
  }

  advance(minutes: number) {
    if (!Number.isFinite(minutes) || minutes < 0) throw new Error('Tempo inválido');
    this.elapsedMs += minutes * 60_000;
  }

  create(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    this.rows.set(tokenHash, {
      userId,
      tokenHash,
      createdAt: this.now,
      lastSeenAt: this.now,
      expiresAt: this.now + 8 * 60 * 60_000,
      revoked: false,
    });
    return token;
  }

  authenticate(token: string) {
    const session = this.rows.get(hashToken(token));
    if (
      !session ||
      session.revoked ||
      session.expiresAt <= this.now ||
      session.lastSeenAt <= this.now - 30 * 60_000
    ) {
      throw new SimulatedHttpError(401, 'unauthorized');
    }
    session.lastSeenAt = this.now;
    return session.userId;
  }

  revoke(token: string) {
    this.authenticate(token);
    this.rows.get(hashToken(token))!.revoked = true;
  }

  revokeOthers(userId: string, currentToken: string) {
    for (const row of this.rows.values()) {
      if (row.userId === userId && row.tokenHash !== hashToken(currentToken)) row.revoked = true;
    }
  }

  snapshot() {
    return structuredClone([...this.rows.values()]);
  }
}
