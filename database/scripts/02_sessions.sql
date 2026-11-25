-- Inicialização de banco vazio pelo entrypoint do PostgreSQL.
-- Ordem de execução e migrações: consulte ../README.md.

BEGIN;

CREATE TABLE IF NOT EXISTS sessions (
    id           uuid        NOT NULL DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL,
    token_hash   bytea       NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    revoked_at   timestamptz,

    CONSTRAINT pk_sessions
        PRIMARY KEY (id),
    CONSTRAINT fk_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT uq_sessions_token_hash
        UNIQUE (token_hash),
    CONSTRAINT ck_sessions_token_hash_length
        CHECK (octet_length(token_hash) = 32),
    CONSTRAINT ck_sessions_expires_at
        CHECK (expires_at > created_at)
);

-- A revogação das demais sessões procura pelo titular. A autenticação localiza
-- uma única linha pelo índice de uq_sessions_token_hash antes de verificar os prazos.
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

COMMENT ON TABLE sessions IS
    'Sessões de contas autenticadas, sujeitas a inatividade, expiração absoluta e revogação.';

COMMENT ON COLUMN sessions.id IS
    'Identificador da sessão gerado pelo PostgreSQL.';

COMMENT ON COLUMN sessions.user_id IS
    'Conta à qual a sessão concede acesso.';

COMMENT ON COLUMN sessions.token_hash IS
    'Resumo SHA-256 de 32 bytes do token opaco enviado no cookie.';

COMMENT ON COLUMN sessions.created_at IS
    'Instante da emissão da sessão, usado para calcular o prazo absoluto.';

COMMENT ON COLUMN sessions.last_seen_at IS
    'Instante da última requisição autenticada, usado para calcular a expiração por inatividade.';

COMMENT ON COLUMN sessions.expires_at IS
    'Prazo absoluto da sessão, calculado pela API a partir da duração configurada.';

COMMENT ON COLUMN sessions.revoked_at IS
    'Instante de revogação por logout ou troca de senha. NULL indica que a sessão ainda não foi revogada.';


COMMIT;
