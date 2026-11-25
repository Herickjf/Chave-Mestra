export type Layer = 'CLIENTE' | 'REDE SIMULADA' | 'API SIMULADA' | 'BANCO EM MEMÓRIA';
export type Trace = (layer: Layer, message: string) => void;

export type PublicAccount = {
  id: string;
  email: string;
  kdfSalt: string;
  kdfIterations: number;
  wrappedVaultKey: string;
  wrappedVaultIv: string;
};

export type RegisterInput = PublicAccount & { authKey: string };

export type ChangePasswordInput = {
  currentAuthKey: string;
  newAuthKey: string;
  newKdfSalt: string;
  newKdfIterations: number;
  newWrappedVaultKey: string;
  newWrappedVaultIv: string;
};

export type StoredItem = {
  id: string;
  userId: string;
  iv: string;
  ciphertext: string;
  version: number;
};

/** Representa um status HTTP, mas nenhuma requisição HTTP real é feita. */
export class SimulatedHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`${status} ${code}`);
    this.name = 'SimulatedHttpError';
  }
}

export const silentTrace: Trace = () => {};
