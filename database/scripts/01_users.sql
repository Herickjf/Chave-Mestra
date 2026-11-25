-- Inicialização de banco vazio pelo entrypoint do PostgreSQL.
-- Ordem de execução e migrações: consulte ../README.md.

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
    id                uuid        NOT NULL,
    email             citext      NOT NULL,
    auth_hash         text        NOT NULL,
    kdf_salt          bytea       NOT NULL,
    kdf_iterations    integer     NOT NULL,
    wrapped_vault_key bytea       NOT NULL,
    wrapped_vault_iv  bytea       NOT NULL,
    failed_attempts   integer     NOT NULL DEFAULT 0,
    locked_until      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_users
        PRIMARY KEY (id),
    CONSTRAINT uq_users_email
        UNIQUE (email),
    CONSTRAINT uq_users_kdf_salt
        UNIQUE (kdf_salt),
    CONSTRAINT ck_users_kdf_salt_length
        CHECK (octet_length(kdf_salt) = 16),
    CONSTRAINT ck_users_kdf_iterations
        CHECK (kdf_iterations >= 600000),
    CONSTRAINT ck_users_wrapped_vault_key_length
        CHECK (octet_length(wrapped_vault_key) BETWEEN 48 AND 128),
    CONSTRAINT ck_users_wrapped_vault_iv_length
        CHECK (octet_length(wrapped_vault_iv) = 12),
    CONSTRAINT ck_users_failed_attempts
        CHECK (failed_attempts >= 0)
);

COMMENT ON TABLE users IS
    'Contas cadastradas, parâmetros de autenticação e chave embrulhada de cada cofre.';

COMMENT ON COLUMN users.id IS
    'UUID gerado pelo cliente antes do cadastro e usado nos dados associados (AAD) da chave e dos itens.';

COMMENT ON COLUMN users.email IS
    'E-mail de cadastro e login. A unicidade e a busca ignoram diferenças de maiúsculas e minúsculas.';

COMMENT ON COLUMN users.auth_hash IS
    'Hash Argon2id do authKey, com os parâmetros e o salt próprios do hash de autenticação.';

COMMENT ON COLUMN users.kdf_salt IS
    'Salt aleatório de 16 bytes do PBKDF2, exclusivo da conta e renovado na troca da senha mestra.';

COMMENT ON COLUMN users.kdf_iterations IS
    'Número de iterações do PBKDF2-HMAC-SHA256 usado pelo cliente para esta conta.';

COMMENT ON COLUMN users.wrapped_vault_key IS
    'Chave do cofre cifrada com a KEK (32 bytes) e tag AES-GCM (16 bytes). O campo admite um envelope opcional de até 128 bytes no total.';

COMMENT ON COLUMN users.wrapped_vault_iv IS
    'Vetor de inicialização de 12 bytes usado no último embrulho da chave do cofre.';

COMMENT ON COLUMN users.failed_attempts IS
    'Contagem de falhas consecutivas de autenticação, zerada após um login bem-sucedido.';

COMMENT ON COLUMN users.locked_until IS
    'Fim do bloqueio temporário de login. NULL indica ausência de bloqueio programado.';

COMMENT ON COLUMN users.created_at IS
    'Instante do cadastro da conta.';

COMMENT ON COLUMN users.updated_at IS
    'Instante da última atualização dos dados cadastrais ou criptográficos, informado pela API na alteração.';


COMMIT;
