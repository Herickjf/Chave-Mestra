CREATE EXTENSION IF NOT EXISTS citext;
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email CITEXT NOT NULL UNIQUE,
  auth_hash TEXT NOT NULL,
  kdf_salt BYTEA NOT NULL CHECK (octet_length(kdf_salt) = 16),
  kdf_iterations INTEGER NOT NULL CHECK (kdf_iterations >= 600000),
  wrapped_vault_key BYTEA NOT NULL,
  wrapped_vault_iv BYTEA NOT NULL CHECK (octet_length(wrapped_vault_iv) = 12),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS vault_items (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  iv BYTEA NOT NULL CHECK (octet_length(iv) = 12),
  ciphertext BYTEA NOT NULL CHECK (octet_length(ciphertext) BETWEEN 16 AND 65536),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vault_items_user_id_idx ON vault_items(user_id);
