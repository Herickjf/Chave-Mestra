/** Nomes e tipos retornados pelo PostgreSQL; a API converte bytes em base64url. */
export type UserRow = {
  id: string;
  email: string;
  auth_hash: string;
  kdf_salt: Buffer;
  kdf_iterations: number;
  wrapped_vault_key: Buffer;
  wrapped_vault_iv: Buffer;
  failed_attempts: number;
  locked_until: Date | null;
};

export type ItemRow = {
  id: string;
  iv: Buffer;
  ciphertext: Buffer;
  version: number;
  created_at: Date;
  updated_at: Date;
};
