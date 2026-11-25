-- Inicialização de banco vazio pelo entrypoint do PostgreSQL.
-- Ordem de execução e migrações: consulte ../README.md.

BEGIN;

CREATE TABLE IF NOT EXISTS vault_items (
    id         uuid        NOT NULL,
    user_id    uuid        NOT NULL,
    iv         bytea       NOT NULL,
    ciphertext bytea       NOT NULL,
    version    integer     NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_vault_items
        PRIMARY KEY (id),
    CONSTRAINT fk_vault_items_user_id
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT uq_vault_items_user_id_iv
        UNIQUE (user_id, iv) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_vault_items_iv_length
        CHECK (octet_length(iv) = 12),
    CONSTRAINT ck_vault_items_ciphertext_length
        CHECK (octet_length(ciphertext) BETWEEN 16 AND 65536),
    CONSTRAINT ck_vault_items_version
        CHECK (version >= 1)
);

-- A listagem filtra pela FK e ordena por atualização. Na edição, a PK localiza
-- o item e a API confere titular e versão na mesma instrução.
CREATE INDEX IF NOT EXISTS idx_vault_items_user_id_updated_at ON vault_items (user_id, updated_at DESC);

COMMENT ON TABLE vault_items IS
    'Credenciais de contas cadastradas, cifradas no navegador. A busca por título e URL ocorre no cliente.';

COMMENT ON CONSTRAINT uq_vault_items_user_id_iv ON vault_items IS
    'A unicidade abrange os IVs dos itens atuais de cada cofre. IVs substituídos ou excluídos deixam de ser verificados. Para cumprir RNF05, o cliente deve gerar um IV novo a cada cifragem com a mesma chave.';

COMMENT ON COLUMN vault_items.id IS
    'UUID v4 gerado pelo cliente na criação e autenticado no AAD junto ao UUID do titular.';

COMMENT ON COLUMN vault_items.user_id IS
    'Titular do cofre e identificador usado nas consultas de autorização e no AAD.';

COMMENT ON COLUMN vault_items.iv IS
    'Vetor de inicialização aleatório de 12 bytes, gerado a cada cifragem com a chave do cofre.';

COMMENT ON COLUMN vault_items.ciphertext IS
    'JSON cifrado com título, URL, usuário, senha e notas. O limite de 65.536 bytes inclui a tag GCM de 16 bytes.';

COMMENT ON COLUMN vault_items.version IS
    'Versão do item para controle otimista. A API confere a versão atual e a incrementa a cada edição.';

COMMENT ON COLUMN vault_items.created_at IS
    'Instante de criação do item.';

COMMENT ON COLUMN vault_items.updated_at IS
    'Instante da última gravação do item, atualizado pela API a cada edição.';


COMMIT;
