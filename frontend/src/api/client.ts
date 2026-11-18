export type StoredItem = {
  id: string;
  iv: string;
  ciphertext: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type Me = {
  userId: string;
  email: string;
  kdfSalt: string;
  kdfIterations: number;
  wrappedVaultKey: string;
  wrappedVaultIv: string;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'vaultzero' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error');
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error ?? 'unknown_error');
  return data as T;
}
